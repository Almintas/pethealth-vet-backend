import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { RATE_LIMIT_KEY, RateLimitRule } from './rate-limit.decorator';
import { RateLimitStore } from './rate-limit.store';

export const TOO_MANY_REQUESTS_MESSAGE =
  'Too many attempts. Please wait a moment and try again.';

type RequestLike = {
  ip?: string;
  socket?: { remoteAddress?: string };
};

function readPath(source: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      source,
    );
}

/**
 * Applies @RateLimit rules to GraphQL operations. Registered globally; does
 * nothing for operations without a rule.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly store: RateLimitStore,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = this.reflector.getAllAndOverride<RateLimitRule | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!rule || context.getType<string>() !== 'graphql') {
      return true;
    }

    const gqlContext = GqlExecutionContext.create(context);
    const req = gqlContext.getContext<{ req?: RequestLike }>().req;
    const ip = req?.ip || req?.socket?.remoteAddress || 'unknown';

    let retryAfter = this.store.hit(
      `${rule.name}:ip:${ip}`,
      rule.perIp,
      rule.windowMs,
    );

    if (rule.perIdentifier) {
      const raw = readPath(gqlContext.getArgs(), rule.perIdentifier.path);
      if (typeof raw === 'string' && raw.trim()) {
        retryAfter = Math.max(
          retryAfter,
          this.store.hit(
            `${rule.name}:id:${raw.trim().toLowerCase()}`,
            rule.perIdentifier.limit,
            rule.windowMs,
          ),
        );
      }
    }

    if (retryAfter > 0) {
      throw new HttpException(
        { message: TOO_MANY_REQUESTS_MESSAGE, retryAfterSeconds: retryAfter },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
