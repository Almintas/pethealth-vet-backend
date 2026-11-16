import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { OWNER_SERVICE_SECRET_HEADER } from './owner-integration.constants';

export type OwnerAttachment = {
  id: string;
  medicalRecordId: string;
  fileName: string;
  contentType: string;
  size: number;
  clinicId?: string | null;
  clinicName?: string | null;
  uploadedByName?: string | null;
  createdAt: string;
};

export type AttachmentUpload = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

export type AttachmentDownload = {
  stream: Readable;
  contentType: string;
  contentLength?: string;
  contentDisposition?: string;
};

const UNAVAILABLE_MESSAGE =
  'Files cannot be reached in the Owner system right now. Please try again.';

/**
 * Attachment files live in the Owner backend; these calls go to its
 * internal REST endpoints with the service secret. Callers check the clinic
 * user's access to the pet first.
 */
@Injectable()
export class OwnerAttachmentsClient {
  private readonly logger = new Logger(OwnerAttachmentsClient.name);

  constructor(private readonly configService: ConfigService) {}

  async upload(
    medicalRecordId: string,
    file: AttachmentUpload,
    uploader: { clinicId: string; clinicName: string; uploadedByName: string },
  ): Promise<OwnerAttachment> {
    const form = new FormData();
    form.append('clinicId', uploader.clinicId);
    form.append('clinicName', uploader.clinicName);
    form.append('uploadedByName', uploader.uploadedByName);
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype || 'application/octet-stream',
      }),
      file.originalname || 'file',
    );
    const response = await this.request(
      'POST',
      `/internal/medical-records/${encodeURIComponent(medicalRecordId)}/attachments`,
      form,
    );
    return (await response.json()) as OwnerAttachment;
  }

  async download(
    medicalRecordId: string,
    attachmentId: string,
  ): Promise<AttachmentDownload> {
    const response = await this.request(
      'GET',
      this.attachmentPath(medicalRecordId, attachmentId),
    );
    if (!response.body) {
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }
    return {
      stream: Readable.fromWeb(response.body as WebReadableStream<Uint8Array>),
      contentType:
        response.headers.get('content-type') ?? 'application/octet-stream',
      contentLength: response.headers.get('content-length') ?? undefined,
      contentDisposition:
        response.headers.get('content-disposition') ?? undefined,
    };
  }

  async delete(
    medicalRecordId: string,
    attachmentId: string,
    clinicId: string,
  ): Promise<OwnerAttachment> {
    const response = await this.request(
      'DELETE',
      `${this.attachmentPath(medicalRecordId, attachmentId)}?clinicId=${encodeURIComponent(clinicId)}`,
    );
    return (await response.json()) as OwnerAttachment;
  }

  private attachmentPath(medicalRecordId: string, attachmentId: string) {
    return `/internal/medical-records/${encodeURIComponent(medicalRecordId)}/attachments/${encodeURIComponent(attachmentId)}`;
  }

  /** Owner REST base: OWNER_GRAPHQL_URL without its /graphql path. */
  private baseUrl(): { base: string; secret: string } {
    const url = this.configService.get<string>('owner.graphqlUrl')?.trim();
    const secret = this.configService
      .get<string>('owner.serviceSecret')
      ?.trim();
    if (!url || !secret) {
      throw new ServiceUnavailableException(
        'Owner file integration is not configured',
      );
    }
    return { base: url.replace(/\/graphql\/?$/, ''), secret };
  }

  private async request(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: FormData,
  ): Promise<Response> {
    const { base, secret } = this.baseUrl();
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        method,
        headers: { [OWNER_SERVICE_SECRET_HEADER]: secret },
        body,
      });
    } catch (error) {
      this.logger.warn(
        `Owner attachment ${method} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }
    if (response.ok) {
      return response;
    }
    throw await this.toHttpException(response, method);
  }

  /** Passes the Owner backend's user-facing refusals through unchanged. */
  private async toHttpException(
    response: Response,
    method: string,
  ): Promise<HttpException> {
    let message: string | undefined;
    try {
      const payload = (await response.json()) as {
        message?: string | string[];
      };
      message = Array.isArray(payload.message)
        ? payload.message.join(' ')
        : payload.message;
    } catch {
      message = undefined;
    }
    switch (response.status) {
      case 400:
        return new BadRequestException(message ?? 'The file was not accepted');
      case 403:
        return new ForbiddenException(message ?? 'Access denied');
      case 404:
        return new NotFoundException('Attachment not found');
      case 413:
        return new PayloadTooLargeException(
          'The file is too large. Attach files up to 10 MB.',
        );
      default:
        this.logger.warn(
          `Owner attachment ${method} answered HTTP ${response.status}`,
        );
        return new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }
  }
}
