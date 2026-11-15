import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../common/enums/user-role.enum';
import { PasswordService } from '../common/services/password.service';
import { UsersService } from '../users/users.service';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    validateCredentials: jest.fn(),
    create: jest.fn(),
    deleteById: jest.fn(),
  };
  const veterinariansService = {
    createProfile: jest.fn(),
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
        { provide: VeterinariansService, useValue: veterinariansService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: PasswordService,
          useValue: { hash: jest.fn(), compare: jest.fn() },
        },
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
    expect(result.user?.email).toBe('vet@clinic.test');
    expect(result.twoFactorRequired).toBe(false);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-id',
      email: 'vet@clinic.test',
      role: UserRole.VETERINARIAN,
    });
  });

  it('asks for a second factor instead of a session when 2FA is on', async () => {
    usersService.validateCredentials.mockResolvedValue({
      _id: 'user-id',
      email: 'vet@clinic.test',
      role: UserRole.VETERINARIAN,
      twoFactorEnabled: true,
    });
    jwtService.signAsync.mockResolvedValue('pending-token');

    const result = await service.login('vet@clinic.test', 'password123');

    expect(result).toEqual({
      accessToken: null,
      user: null,
      twoFactorRequired: true,
      twoFactorToken: 'pending-token',
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'user-id', purpose: '2fa-pending' },
      { expiresIn: '5m' },
    );
  });

  it('rejects invalid credentials', async () => {
    usersService.validateCredentials.mockResolvedValue(null);

    await expect(
      service.login('vet@clinic.test', 'wrong'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('registers a veterinarian with profile and JWT', async () => {
    const now = new Date();
    usersService.create.mockResolvedValue({
      _id: 'user-id',
      email: 'new@clinic.test',
      role: UserRole.VETERINARIAN,
      createdAt: now,
      updatedAt: now,
    });
    veterinariansService.createProfile.mockResolvedValue({
      _id: 'profile-id',
      userId: 'user-id',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    jwtService.signAsync.mockResolvedValue('token');

    const result = await service.registerVeterinarian({
      email: 'new@clinic.test',
      password: 'password123',
      firstName: 'Jane',
      lastName: 'Doe',
      licenseNumber: 'VET-12345',
    });

    expect(usersService.create).toHaveBeenCalledWith({
      email: 'new@clinic.test',
      password: 'password123',
      role: UserRole.VETERINARIAN,
    });
    expect(veterinariansService.createProfile).toHaveBeenCalled();
    expect(result.accessToken).toBe('token');
    expect(result.user.email).toBe('new@clinic.test');
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rolls back user when profile creation fails', async () => {
    usersService.create.mockResolvedValue({
      _id: 'user-id',
      email: 'new@clinic.test',
      role: UserRole.VETERINARIAN,
    });
    veterinariansService.createProfile.mockRejectedValue(
      new ConflictException('profile exists'),
    );

    await expect(
      service.registerVeterinarian({
        email: 'new@clinic.test',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Doe',
        licenseNumber: 'VET-12345',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(usersService.deleteById).toHaveBeenCalledWith('user-id');
  });

  it('surfaces duplicate email from user creation', async () => {
    usersService.create.mockRejectedValue(
      new ConflictException('Email is already registered'),
    );

    await expect(
      service.registerVeterinarian({
        email: 'taken@clinic.test',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Doe',
        licenseNumber: 'VET-12345',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
