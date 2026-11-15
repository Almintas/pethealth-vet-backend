import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'pethealth:rate-limit';

export type RateLimitRule = {
  /** Bucket name, e.g. "login". Rules with the same name share counters. */
  name: string;
  /** Allowed requests per window for one client IP. */
  perIp: number;
  windowMs: number;
  /**
   * Optional dotted path to a GraphQL argument (e.g. "input.email") that is
   * also limited on its own, so one account can't be attacked from many IPs.
   */
  perIdentifier?: { path: string; limit: number };
};

/** Limits how often one client can call a GraphQL operation. */
export const RateLimit = (rule: RateLimitRule) =>
  SetMetadata(RATE_LIMIT_KEY, rule);
