import { RateLimitRule } from './rate-limit.decorator';

const MINUTE = 60_000;

/** Central list so the limits are easy to review and tune. */
export const RATE_LIMITS = {
  login: {
    name: 'login',
    perIp: 20,
    windowMs: 15 * MINUTE,
    perIdentifier: { path: 'input.email', limit: 8 },
  },
  register: { name: 'register', perIp: 10, windowMs: 60 * MINUTE },
  claimByCode: { name: 'claim-by-code', perIp: 20, windowMs: 15 * MINUTE },
  invitationPreview: {
    name: 'invitation-preview',
    perIp: 30,
    windowMs: 15 * MINUTE,
  },
  invitationAccept: {
    name: 'invitation-accept',
    perIp: 20,
    windowMs: 15 * MINUTE,
  },
  invitationRegister: {
    name: 'invitation-register',
    perIp: 10,
    windowMs: 60 * MINUTE,
  },
  invite: { name: 'invite', perIp: 30, windowMs: 60 * MINUTE },
  twoFactorLogin: {
    name: 'two-factor-login',
    perIp: 15,
    windowMs: 15 * MINUTE,
    perIdentifier: { path: 'input.twoFactorToken', limit: 5 },
  },
  twoFactorCode: { name: 'two-factor-code', perIp: 15, windowMs: 15 * MINUTE },
  // Microchip numbers are guessable; keep lookups at a human pace.
  microchipSearch: {
    name: 'microchip-search',
    perIp: 30,
    windowMs: 15 * MINUTE,
  },
  microchipNotify: {
    name: 'microchip-notify',
    perIp: 10,
    windowMs: 60 * MINUTE,
  },
} satisfies Record<string, RateLimitRule>;
