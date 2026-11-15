import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole } from '../common/enums/user-role.enum';
import { PasswordService } from '../common/services/password.service';
import { User } from './schemas/user.schema';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const passwordService = {
    hash: jest.fn().mockResolvedValue('hashed'),
    compare: jest.fn(),
  };

  const save = jest.fn();
  const userModel = jest.fn().mockImplementation((data) => ({
    ...data,
    save,
  })) as jest.Mock & {
    findOne: jest.Mock;
    findById: jest.Mock;
  };
  userModel.findOne = jest.fn();
  userModel.findById = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: PasswordService, useValue: passwordService },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('creates a user with hashed password', async () => {
    userModel.findOne.mockResolvedValue(null);
    save.mockResolvedValue({
      _id: 'user-id',
      email: 'vet@clinic.test',
      role: UserRole.VETERINARIAN,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const created = await service.create({
      email: 'vet@clinic.test',
      password: 'password123',
    });

    expect(passwordService.hash).toHaveBeenCalledWith('password123');
    expect(created.email).toBe('vet@clinic.test');
  });

  it('rejects duplicate emails', async () => {
    userModel.findOne.mockResolvedValue({ email: 'vet@clinic.test' });

    await expect(
      service.create({ email: 'vet@clinic.test', password: 'password123' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('validates credentials', async () => {
    const userDoc = {
      _id: 'user-id',
      email: 'vet@clinic.test',
      passwordHash: 'hashed',
      role: UserRole.VETERINARIAN,
    };
    userModel.findOne.mockReturnValue({
      select: () => ({ exec: async () => userDoc }),
    });
    passwordService.compare.mockResolvedValue(true);

    const result = await service.validateCredentials(
      'vet@clinic.test',
      'password123',
    );
    expect(result).toEqual(userDoc);

    passwordService.compare.mockResolvedValue(false);
    await expect(
      service.validateCredentials('vet@clinic.test', 'wrong'),
    ).resolves.toBeNull();
  });
});
