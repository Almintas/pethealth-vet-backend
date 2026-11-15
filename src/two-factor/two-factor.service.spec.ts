import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import { TWO_FACTOR_PENDING_PURPOSE } from '../common/interfaces/jwt-payload.interface';
import { SecretBox } from './secret-box';
import { base32Decode, hotp, totpStep } from './totp';
import { TwoFactorService } from './two-factor.service';

const KEY = 'test-jwt-secret';
const box = new SecretBox(KEY);
const currentCode = (secret: string) =>
  hotp(base32Decode(secret), totpStep(Date.now()));
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

type FakeUser = Record<string, unknown> & { save: jest.Mock };

describe('TwoFactorService', () => {
  const userId = new Types.ObjectId();
  let user: FakeUser;
  const userModel = { findById: jest.fn(), updateOne: jest.fn() };
  const jwtService = { verifyAsync: jest.fn() };
  const authService = { issueAuthPayload: jest.fn() };
  const configService = {
    get: jest.fn((key: string) => (key === 'jwt.secret' ? KEY : undefined)),
  };
  let service: TwoFactorService;

  function mockUpdateResult(modifiedCount: number) {
    userModel.updateOne.mockReturnValue({
      exec: jest
        .fn<() => Promise<unknown>>()
        .mockResolvedValue({ modifiedCount }),
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    user = {
      _id: userId,
      email: 'vet@clinic.lt',
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorPendingSecret: null,
      twoFactorRecoveryCodes: [],
      save: jest.fn(),
    };
    userModel.findById.mockReturnValue({
      select: () => ({
        exec: jest.fn<() => Promise<unknown>>().mockResolvedValue(user),
      }),
    });
    service = new TwoFactorService(
      userModel as never,
      jwtService as never,
      authService as never,
      configService as never,
    );
  });

  it('sets up two-factor sign-in after a valid first code', async () => {
    const setup = await service.startSetup(userId.toString());
    expect(setup.otpauthUrl).toContain(`secret=${setup.secret}`);
    expect(user.twoFactorPendingSecret).not.toContain(setup.secret);

    await expect(
      service.confirmSetup(userId.toString(), '000000'),
    ).rejects.toBeInstanceOf(BadRequestException);

    const result = await service.confirmSetup(
      userId.toString(),
      currentCode(setup.secret),
    );
    expect(user.twoFactorEnabled).toBe(true);
    expect(user.twoFactorPendingSecret).toBeNull();
    expect(result.recoveryCodes).toHaveLength(8);
    expect(user.twoFactorRecoveryCodes).toEqual(
      result.recoveryCodes.map((code) => sha256(code.replace('-', ''))),
    );
  });

  it('refuses to start setup when already enabled', async () => {
    user.twoFactorEnabled = true;
    await expect(service.startSetup(userId.toString())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  describe('verifyLogin', () => {
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

    beforeEach(() => {
      user.twoFactorEnabled = true;
      user.twoFactorSecret = box.encrypt(secret);
      jwtService.verifyAsync.mockResolvedValue({
        sub: userId.toString(),
        purpose: TWO_FACTOR_PENDING_PURPOSE,
      } as never);
      authService.issueAuthPayload.mockResolvedValue({
        accessToken: 'session',
      } as never);
    });

    it('issues a session for a valid authenticator code', async () => {
      mockUpdateResult(1);
      await expect(
        service.verifyLogin('pending', currentCode(secret)),
      ).resolves.toEqual({
        accessToken: 'session',
      });
    });

    it('refuses a replayed code', async () => {
      mockUpdateResult(0);
      await expect(
        service.verifyLogin('pending', currentCode(secret)),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts an unused recovery code once', async () => {
      mockUpdateResult(1);
      await service.verifyLogin('pending', 'ABCDE-12345');
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: userId, twoFactorRecoveryCodes: sha256('abcde12345') },
        { $pull: { twoFactorRecoveryCodes: sha256('abcde12345') } },
      );
    });

    it('rejects tokens that are not two-factor pending tokens', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: userId.toString(),
      } as never);
      await expect(
        service.verifyLogin('session-token', '123456'),
      ).rejects.toThrow(TwoFactorService.SIGN_IN_EXPIRED_MESSAGE);
    });

    it('rejects expired tokens', async () => {
      jwtService.verifyAsync.mockRejectedValue(
        new Error('jwt expired') as never,
      );
      await expect(service.verifyLogin('old', '123456')).rejects.toThrow(
        TwoFactorService.SIGN_IN_EXPIRED_MESSAGE,
      );
    });
  });
});
