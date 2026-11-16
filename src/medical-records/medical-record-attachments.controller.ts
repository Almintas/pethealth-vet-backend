import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditEntityType } from '../audit/enums/audit.enums';
import { ACCOUNT_NOT_APPROVED_MESSAGE } from '../auth/guards/gql-roles.guard';
import { AccountApprovalStatus } from '../common/enums/account-approval-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import {
  AttachmentClinicQuery,
  UploadAttachmentBody,
} from './dto/attachment-request.dto';
import { VetMedicalRecordAttachmentObject } from './dto/medical-record-attachment.object';
import { MedicalRecordsService } from './medical-records.service';

/** Same limit as the Owner system enforces. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const CLINICAL_ROLES = new Set<UserRole>([
  UserRole.VETERINARIAN,
  UserRole.CLINIC_ADMIN,
  UserRole.RECEPTIONIST,
]);

type UploadedAttachmentFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

/**
 * Multer reads multipart file names as latin1; turn UTF-8 names such as
 * "Krūtinės.pdf" back into readable text before passing them on.
 */
export function decodeMultipartFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  if (/[^\u0000-\u00ff]/.test(name)) {
    return name;
  }
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\ufffd') ? name : decoded;
}

/** The REST twin of GqlRolesGuard for the clinical roles. */
function clinicalUser(request: { user?: UserDocument }): UserDocument {
  const user = request.user;
  if (!user || !CLINICAL_ROLES.has(user.role)) {
    throw new ForbiddenException('Access denied');
  }
  if (user.approvalStatus !== AccountApprovalStatus.APPROVED) {
    throw new ForbiddenException(ACCOUNT_NOT_APPROVED_MESSAGE);
  }
  return user;
}

/**
 * Files on medical records. Bytes are binary, so these are REST endpoints;
 * the record's attachment list comes with the GraphQL record.
 */
@Controller('medical-records')
@UseGuards(AuthGuard('jwt'))
export class MedicalRecordAttachmentsController {
  constructor(
    private readonly medicalRecordsService: MedicalRecordsService,
    private readonly auditService: AuditService,
  ) {}

  @Post(':recordId/attachments')
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: ATTACHMENT_MAX_BYTES, files: 1 },
    }),
  )
  async upload(
    @Req() request: { user?: UserDocument },
    @Param('recordId') recordId: string,
    @Body() body: UploadAttachmentBody,
    @UploadedFile() file: UploadedAttachmentFile | undefined,
  ): Promise<VetMedicalRecordAttachmentObject> {
    const user = clinicalUser(request);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Choose a file to attach.');
    }
    const userId = user._id.toString();
    const { petId, recordTitle, attachment } =
      await this.medicalRecordsService.addAttachment(
        userId,
        recordId,
        body.clinicId,
        { ...file, originalname: decodeMultipartFileName(file.originalname) },
      );
    await this.auditService.recordClinicActivity({
      actorUserId: userId,
      petId,
      clinicId: body.clinicId,
      action: AuditAction.CREATED,
      entityType: AuditEntityType.ATTACHMENT,
      entityId: attachment.id,
      summary: `${attachment.fileName} · ${recordTitle}`,
    });
    return { ...attachment, createdAt: new Date(attachment.createdAt) };
  }

  @Get(':recordId/attachments/:attachmentId')
  async download(
    @Req() request: { user?: UserDocument },
    @Param('recordId') recordId: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const user = clinicalUser(request);
    const file = await this.medicalRecordsService.openAttachment(
      user._id.toString(),
      recordId,
      attachmentId,
    );
    response.set({
      'Content-Type': file.contentType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(file.contentLength ? { 'Content-Length': file.contentLength } : {}),
      ...(file.contentDisposition
        ? { 'Content-Disposition': file.contentDisposition }
        : {}),
    });
    return new StreamableFile(file.stream);
  }

  @Delete(':recordId/attachments/:attachmentId')
  async remove(
    @Req() request: { user?: UserDocument },
    @Param('recordId') recordId: string,
    @Param('attachmentId') attachmentId: string,
    @Query() query: AttachmentClinicQuery,
  ): Promise<{ id: string }> {
    const user = clinicalUser(request);
    const userId = user._id.toString();
    const { petId, recordTitle, attachment } =
      await this.medicalRecordsService.removeAttachment(
        userId,
        recordId,
        attachmentId,
        query.clinicId,
      );
    await this.auditService.recordClinicActivity({
      actorUserId: userId,
      petId,
      clinicId: query.clinicId,
      action: AuditAction.DELETED,
      entityType: AuditEntityType.ATTACHMENT,
      entityId: attachment.id,
      summary: `${attachment.fileName} · ${recordTitle}`,
    });
    return { id: attachment.id };
  }
}
