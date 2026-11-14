import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import { timingSafeEqual } from 'node:crypto';
import { OWNER_SERVICE_SECRET_HEADER } from '../../owner-integration/owner-integration.constants';

/**
 * Protects internal GraphQL operations called by the Owner backend. Uses the
 * same shared secret (OWNER_SERVICE_SECRET) and header as Vet → Owner calls.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService
      .get<string>('owner.serviceSecret')
      ?.trim();
    if (!expected) {
      throw new UnauthorizedException(
        'Internal service access is not configured',
      );
    }

    const request = GqlExecutionContext.create(context).getContext<{
      req: { headers: Record<string, string | string[] | undefined> };
    }>().req;
    const raw = request.headers[OWNER_SERVICE_SECRET_HEADER];
    const provided = (Array.isArray(raw) ? raw[0] : raw)?.trim();

    if (!provided || !this.secretsEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid internal service credentials');
    }
    return true;
  }

  private secretsEqual(provided: string, expected: string): boolean {
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);
    return (
      providedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(providedBuffer, expectedBuffer)
    );
  }
}
