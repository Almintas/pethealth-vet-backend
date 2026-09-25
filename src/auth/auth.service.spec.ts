import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../common/enums/user-role.enum';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    validateCredentials: jest.fn(),
  };
  const jwtService = {
    signAsync: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('returns a JWT and user on successful login', async () => {
    const now = new Date();
    usersService.validateCredentials.mockResolvedValue({
      _id: 'user-id',
      email: 'vet@clinic.test',
      role: UserRole.VETERINARIAN,
      createdAt: now,
      updatedAt: now,
    });
    jwtService.signAsync.mockResolvedValue('token');

    const result = await service.login('vet@clinic.test', 'password123');

    expect(result.accessToken).toBe('token');
    expect(result.user.email).toBe('vet@clinic.test');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-id',
      email: 'vet@clinic.test',
      role: UserRole.VETERINARIAN,
    });
  });

  it('rejects invalid credentials', async () => {
    usersService.validateCredentials.mockResolvedValue(null);

    await expect(
      service.login('vet@clinic.test', 'wrong'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
