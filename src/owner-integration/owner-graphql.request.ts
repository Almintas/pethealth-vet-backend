import {
  BadGatewayException,
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OWNER_SERVICE_SECRET_HEADER } from './owner-integration.constants';

type OwnerGraphqlPayload = {
  data?: Record<string, unknown> | null;
  errors?: { message?: string }[];
};

export type OwnerGraphqlRequestOptions = {
  configService: ConfigService;
  logger: Logger;
  query: string;
  variables: Record<string, unknown>;
  /** Field of `data` that holds the result, e.g. `internalPetsByIds`. */
  resultKey: string;
  /** Generic message shown when the Owner system is unreachable. */
  failureMessage: string;
  /** Message used when the integration env vars are missing. */
  notConfiguredMessage: string;
  /** Accept `null` as a valid result (e.g. optional lookups). */
  allowNullResult?: boolean;
};

const OWNER_INTEGRATION_MISCONFIGURED_MESSAGE =
  'Owner system integration is not configured correctly. Contact support.';

/**
 * Turns an Owner-system GraphQL error into a message for the clinic user.
 * Business errors ("owner account already exists", "access revoked") are
 * passed through; generic or credential errors fall back to a safe message.
 */
export function toOwnerIntegrationUserMessage(
  ownerMessage: string,
  fallback: string,
): string {
  const normalized = ownerMessage.trim().toLowerCase();
  if (
    !normalized ||
    normalized === 'bad request exception' ||
    normalized === 'internal server error' ||
    normalized.includes('validation failed')
  ) {
    return fallback;
  }
  if (
    normalized.includes('unauthorized') ||
    normalized.includes('internal service')
  ) {
    return OWNER_INTEGRATION_MISCONFIGURED_MESSAGE;
  }
  return ownerMessage.trim();
}

async function readPayload(
  response: Response,
): Promise<OwnerGraphqlPayload | undefined> {
  try {
    return (await response.json()) as OwnerGraphqlPayload;
  } catch {
    return undefined;
  }
}

/**
 * Sends a service-to-service GraphQL request to the Owner backend.
 *
 * Error contract (shared by every owner-integration client):
 * - Owner GraphQL errors → BadGatewayException with the owner's message, so
 *   the clinic user sees why the action was refused.
 * - Missing configuration, network failures, non-JSON or empty responses →
 *   ServiceUnavailableException with `failureMessage`.
 * - Any HttpException raised along the way is rethrown unchanged.
 */
export async function requestOwnerGraphql<T>(
  options: OwnerGraphqlRequestOptions,
): Promise<T> {
  const {
    configService,
    logger,
    query,
    variables,
    resultKey,
    failureMessage,
    notConfiguredMessage,
    allowNullResult = false,
  } = options;

  const url = configService.get<string>('owner.graphqlUrl')?.trim();
  const secret = configService.get<string>('owner.serviceSecret')?.trim();
  if (!url || !secret) {
    throw new ServiceUnavailableException(notConfiguredMessage);
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [OWNER_SERVICE_SECRET_HEADER]: secret,
      },
      body: JSON.stringify({ query, variables }),
    });

    const payload = await readPayload(response);

    // GraphQL errors can arrive with a 2xx or a 4xx status (e.g. input
    // validation), so check them before the HTTP status.
    const ownerMessage = payload?.errors?.[0]?.message;
    if (payload?.errors?.length) {
      logger.warn(
        `Owner backend GraphQL error for ${resultKey}: ${ownerMessage ?? 'unknown error'}`,
      );
      throw new BadGatewayException(
        toOwnerIntegrationUserMessage(ownerMessage ?? '', failureMessage),
      );
    }

    if (!response.ok || !payload) {
      logger.warn(
        `Owner backend responded with HTTP ${response.status} for ${resultKey}`,
      );
      throw new ServiceUnavailableException(failureMessage);
    }

    const result = payload.data?.[resultKey];
    if (result === undefined || (result === null && !allowNullResult)) {
      logger.warn(`Owner backend returned no ${resultKey}`);
      throw new ServiceUnavailableException(failureMessage);
    }
    return result as T;
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }
    logger.warn(`Owner backend request failed for ${resultKey}`);
    throw new ServiceUnavailableException(failureMessage);
  }
}
