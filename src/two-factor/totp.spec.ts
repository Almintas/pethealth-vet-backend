import { describe, expect, it } from '@jest/globals';
import {
  base32Decode,
  base32Encode,
  buildOtpauthUrl,
  generateTotpSecret,
  hotp,
  totpStep,
  verifyTotp,
} from './totp';
import { SecretBox } from './secret-box';

// RFC 6238 appendix B (SHA-1), secret = ASCII "12345678901234567890".
const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');

describe('TOTP', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ])('matches the RFC 6238 vector at t=%i', (seconds, expected) => {
    expect(hotp(RFC_SECRET, totpStep(seconds * 1000), 8)).toBe(expected);
  });

  it('round-trips base32', () => {
    const encoded = base32Encode(RFC_SECRET);
    expect(encoded).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode(encoded).equals(RFC_SECRET)).toBe(true);
  });

  it('accepts the current code and one step of drift, nothing older', () => {
    const secret = generateTotpSecret();
    const now = 1_800_000_000_000;
    const key = base32Decode(secret);
    const code = (offset: number) => hotp(key, totpStep(now) + offset);

    expect(verifyTotp(secret, code(0), now)).toBe(totpStep(now));
    expect(verifyTotp(secret, code(-1), now)).toBe(totpStep(now) - 1);
    expect(verifyTotp(secret, code(1), now)).toBe(totpStep(now) + 1);
    expect(verifyTotp(secret, code(-2), now)).toBeNull();
    expect(verifyTotp(secret, 'abcdef', now)).toBeNull();
  });

  it('builds an otpauth link for authenticator apps', () => {
    const url = buildOtpauthUrl({
      secret: 'ABC',
      accountName: 'vet@clinic.lt',
      issuer: 'PetHealth Vet',
    });
    expect(url).toMatch(
      /^otpauth:\/\/totp\/PetHealth%20Vet%3Avet%40clinic\.lt\?/,
    );
    expect(url).toContain('secret=ABC');
    expect(url).toContain('issuer=PetHealth+Vet');
  });
});

describe('SecretBox', () => {
  it('encrypts and decrypts, and rejects a different key', () => {
    const box = new SecretBox('key-one');
    const sealed = box.encrypt('JBSWY3DPEHPK3PXP');
    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP');
    expect(box.decrypt(sealed)).toBe('JBSWY3DPEHPK3PXP');
    expect(() => new SecretBox('key-two').decrypt(sealed)).toThrow();
  });
});
