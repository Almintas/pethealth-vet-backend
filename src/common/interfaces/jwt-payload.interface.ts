import { UserRole } from '../enums/user-role.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  /** Only set on special-purpose tokens, which are never valid sessions. */
  purpose?: string;
}

export const TWO_FACTOR_PENDING_PURPOSE = '2fa-pending';

export interface TwoFactorPendingPayload {
  sub: string;
  purpose: typeof TWO_FACTOR_PENDING_PURPOSE;
}
