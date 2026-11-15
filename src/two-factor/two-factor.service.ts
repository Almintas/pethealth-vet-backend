import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { AuthService } from '../auth/auth.service';
import { AuthPayload } from '../auth/dto/auth-payload.object';
import {
  TWO_FACTOR_PENDING_PURPOSE,
  TwoFactorPendingPayload,
} from '../common/interfaces/jwt-payload.interface';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  TwoFactorRecoveryCodesObject,
  TwoFactorSetupObject,
} from './dto/two-factor.objects';
import { SecretBox } from './secret-box';
import { buildOtpauthUrl, generateTotpSecret, verifyTotp } from './totp';

const SECRET_FIELDS =
  '+twoFactorSecret +twoFactorPendingSecret +twoFactorRecoveryCodes +twoFactorLastUsedStep';
const RECOVERY_CODE_COUNT = 8;
const ISSUER = 'PetHealth Vet';

/**
 * Two-factor sign-in with an authenticator app (RFC 6238 TOTP). Secrets are
 * encrypted at rest; recovery codes are stored as hashes and work once.
 */
@Injectable()
export class TwoFactorService {
  static readonly INVALID_CODE_MESSAGE =
    'That code is not valid. Check the time on your phone and try again.';
  static readonly SIGN_IN_EXPIRED_MESSAGE =
    'Your sign-in has expired. Please sign in again.';

  private readonly box: SecretBox;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    const keyMaterial =
      configService.get<string>('TWO_FACTOR_ENCRYPTION_KEY')?.trim() ||
      configService.get<string>('jwt.secret') ||
      '';
    this.box = new SecretBox(keyMaterial);
  }

  async startSetup(userId: string): Promise<TwoFactorSetupObject> {
    const user = await this.loadUser(userId);
    if (user.twoFactorEnabled) {
      throw new ConflictException('Two-factor sign-in is already turned on.');
    }
    const secret = generateTotpSecret();
    user.twoFactorPendingSecret = this.box.encrypt(secret);
    await user.save();
    return {
      secret,
      otpauthUrl: buildOtpauthUrl({
        secret,
        accountName: user.email,
        issuer: ISSUER,
      }),
    };
  }

  async confirmSetup(
    userId: string,
    code: string,
  ): Promise<TwoFactorRecoveryCodesObject> {
    const user = await this.loadUser(userId);
    if (user.twoFactorEnabled) {
      throw new ConflictException('Two-factor sign-in is already turned on.');
    }
    if (!user.twoFactorPendingSecret) {
      throw new BadRequestException('Start the setup again to get a new key.');
    }
    const secret = this.box.decrypt(user.twoFactorPendingSecret);
    const step = verifyTotp(secret, code);
    if (step === null) {
      throw new BadRequestException(TwoFactorService.INVALID_CODE_MESSAGE);
    }

    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      this.generateRecoveryCode(),
    );
    user.twoFactorSecret = user.twoFactorPendingSecret;
    user.twoFactorPendingSecret = null;
    user.twoFactorEnabled = true;
    user.twoFactorLastUsedStep = step;
    user.twoFactorRecoveryCodes = recoveryCodes.map((value) =>
      this.hashRecoveryCode(value),
    );
    await user.save();
    return { recoveryCodes };
  }

  async disable(userId: string, code: string): Promise<boolean> {
    const user = await this.loadUser(userId);
    if (!user.twoFactorEnabled) {
      return true;
    }
    if (!(await this.checkSecondFactor(user, code))) {
      throw new BadRequestException(TwoFactorService.INVALID_CODE_MESSAGE);
    }
    await this.userModel
      .updateOne(
        { _id: user._id },
        {
          $set: {
            twoFactorEnabled: false,
            twoFactorSecret: null,
            twoFactorPendingSecret: null,
            twoFactorRecoveryCodes: [],
            twoFactorLastUsedStep: null,
          },
        },
      )
      .exec();
    return true;
  }

  /** Second step of sign-in: exchanges the pending token + code for a session. */
  async verifyLogin(
    twoFactorToken: string,
    code: string,
  ): Promise<AuthPayload> {
    let payload: TwoFactorPendingPayload;
    try {
      payload =
        await this.jwtService.verifyAsync<TwoFactorPendingPayload>(
          twoFactorToken,
        );
    } catch {
      throw new UnauthorizedException(TwoFactorService.SIGN_IN_EXPIRED_MESSAGE);
    }
    if (payload.purpose !== TWO_FACTOR_PENDING_PURPOSE || !payload.sub) {
      throw new UnauthorizedException(TwoFactorService.SIGN_IN_EXPIRED_MESSAGE);
    }

    const user = await this.userModel
      .findById(payload.sub)
      .select(SECRET_FIELDS)
      .exec();
    if (!user?.twoFactorEnabled) {
      throw new UnauthorizedException(TwoFactorService.SIGN_IN_EXPIRED_MESSAGE);
    }
    if (!(await this.checkSecondFactor(user, code))) {
      throw new UnauthorizedException(TwoFactorService.INVALID_CODE_MESSAGE);
    }
    return this.authService.issueAuthPayload(user);
  }

  /** Accepts a fresh TOTP code or an unused recovery code (consumed). */
  private async checkSecondFactor(
    user: UserDocument,
    rawCode: string,
  ): Promise<boolean> {
    const code = rawCode.trim();
    if (/^\d{6}$/.test(code.replace(/\s+/g, '')) && user.twoFactorSecret) {
      const step = verifyTotp(this.box.decrypt(user.twoFactorSecret), code);
      if (step === null) {
        return false;
      }
      // Atomically move the last-used step forward; fails if replayed.
      const result = await this.userModel
        .updateOne(
          {
            _id: user._id,
            $or: [
              { twoFactorLastUsedStep: null },
              { twoFactorLastUsedStep: { $lt: step } },
            ],
          },
          { $set: { twoFactorLastUsedStep: step } },
        )
        .exec();
      return result.modifiedCount === 1;
    }

    const hash = this.hashRecoveryCode(code);
    const result = await this.userModel
      .updateOne(
        { _id: user._id, twoFactorRecoveryCodes: hash },
        { $pull: { twoFactorRecoveryCodes: hash } },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  private async loadUser(userId: string): Promise<UserDocument> {
    const user = await this.userModel
      .findById(new Types.ObjectId(userId))
      .select(SECRET_FIELDS)
      .exec();
    if (!user) {
      throw new NotFoundException('Account not found');
    }
    return user;
  }

  private generateRecoveryCode(): string {
    const raw = randomBytes(8).toString('hex').slice(0, 10);
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  }

  private hashRecoveryCode(code: string): string {
    const normalized = code.toLowerCase().replace(/[^a-z0-9]/g, '');
    return createHash('sha256').update(normalized).digest('hex');
  }
}
