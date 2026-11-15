import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../common/enums/user-role.enum';
import {
  JwtPayload,
  TWO_FACTOR_PENDING_PURPOSE,
  TwoFactorPendingPayload,
} from '../common/interfaces/jwt-payload.interface';
import { UserDocument } from '../users/schemas/user.schema';
import { mapUserDocumentToObject } from '../users/users.mapper';
import { UsersService } from '../users/users.service';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { AuthPayload } from './dto/auth-payload.object';
import { RegisterVeterinarianInput } from './dto/register-veterinarian.input';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly veterinariansService: VeterinariansService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<AuthPayload> {
    const user = await this.usersService.validateCredentials(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.twoFactorEnabled) {
      const pending: TwoFactorPendingPayload = {
        sub: user._id.toString(),
        purpose: TWO_FACTOR_PENDING_PURPOSE,
      };
      return {
        accessToken: null,
        user: null,
        twoFactorRequired: true,
        twoFactorToken: await this.jwtService.signAsync(pending, {
          expiresIn: '5m',
        }),
      };
    }

    return this.buildAuthPayload(user);
  }

  async registerVeterinarian(
    input: RegisterVeterinarianInput,
  ): Promise<AuthPayload> {
    let user: UserDocument | undefined;
    try {
      user = await this.usersService.create({
        email: input.email,
        password: input.password,
        role: UserRole.VETERINARIAN,
      });
      await this.veterinariansService.createProfile({
        userId: user._id.toString(),
        firstName: input.firstName,
        lastName: input.lastName,
        licenseNumber: input.licenseNumber,
      });
    } catch (error) {
      if (user) {
        await this.usersService.deleteById(user._id.toString());
      }
      throw error;
    }

    return this.buildAuthPayload(user);
  }

  /** Signs a session for a user created or verified elsewhere (e.g. invitations). */
  issueAuthPayload(user: UserDocument): Promise<AuthPayload> {
    return this.buildAuthPayload(user);
  }

  private async buildAuthPayload(user: UserDocument): Promise<AuthPayload> {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: mapUserDocumentToObject(user),
      twoFactorRequired: false,
    };
  }
}
