import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { VeterinarianProfile } from './schemas/veterinarian-profile.schema';
import { VeterinariansService } from './veterinarians.service';

describe('VeterinariansService', () => {
  let service: VeterinariansService;
  const save = jest.fn();
  const profileModel = jest.fn().mockImplementation((data) => ({
    ...data,
    save,
  })) as jest.Mock & {
    findOne: jest.Mock;
    findById: jest.Mock;
  };
  profileModel.findOne = jest.fn();
  profileModel.findById = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VeterinariansService,
        {
          provide: getModelToken(VeterinarianProfile.name),
          useValue: profileModel,
        },
      ],
    }).compile();

    service = module.get(VeterinariansService);
  });

  it('creates a veterinarian profile', async () => {
    const userId = new Types.ObjectId().toString();
    profileModel.findOne.mockResolvedValue(null);
    save.mockResolvedValue({
      _id: 'profile-id',
      userId: new Types.ObjectId(userId),
      firstName: 'Jane',
      lastName: 'Doe',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const profile = await service.createProfile({
      userId,
      firstName: 'Jane',
      lastName: 'Doe',
    });

    expect(profile.firstName).toBe('Jane');
  });

  it('rejects duplicate profiles per user', async () => {
    profileModel.findOne.mockResolvedValue({ userId: 'existing' });

    await expect(
      service.createProfile({
        userId: new Types.ObjectId().toString(),
        firstName: 'Jane',
        lastName: 'Doe',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
