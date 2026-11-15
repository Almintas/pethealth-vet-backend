import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ClinicMembershipStatus } from '../common/enums/clinic-membership-status.enum';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { ClinicMembership } from './schemas/clinic-membership.schema';
import { Clinic } from './schemas/clinic.schema';
import {
  ClinicsService,
  isTransactionUnsupportedError,
} from './clinics.service';

describe('ClinicsService', () => {
  let service: ClinicsService;
  const save = jest.fn();
  const clinicModel = jest.fn().mockImplementation((data) => ({
    ...data,
    save,
  })) as jest.Mock & {
    create: jest.Mock;
    find: jest.Mock;
    findById: jest.Mock;
    findByIdAndDelete: jest.Mock;
  };
  clinicModel.create = jest.fn();
  clinicModel.find = jest.fn();
  clinicModel.findById = jest.fn();
  clinicModel.findByIdAndDelete = jest.fn();

  const membershipModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const connection = {
    startSession: jest.fn(),
  };

  const veterinariansService = {
    findOptionalByUserId: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: getModelToken(Clinic.name), useValue: clinicModel },
        {
          provide: getModelToken(ClinicMembership.name),
          useValue: membershipModel,
        },
        { provide: getConnectionToken(), useValue: connection },
        { provide: VeterinariansService, useValue: veterinariansService },
      ],
    }).compile();

    service = module.get(ClinicsService);
  });

  it('creates a clinic', async () => {
    save.mockResolvedValue({
      _id: 'clinic-id',
      name: 'Happy Paws',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const clinic = await service.create({ name: 'Happy Paws' });
    expect(clinic.name).toBe('Happy Paws');
  });

  it('rejects clinic creation without veterinarian profile', async () => {
    veterinariansService.findOptionalByUserId.mockResolvedValue(null);

    await expect(
      service.createClinicForUser('user-id', { name: 'Happy Paws' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns only clinics with active memberships for myClinics', async () => {
    const profileId = new Types.ObjectId();
    const clinicId = new Types.ObjectId();
    veterinariansService.findOptionalByUserId.mockResolvedValue({
      _id: profileId,
    });
    membershipModel.find.mockReturnValue({
      exec: async () => [
        {
          veterinarianProfileId: profileId,
          clinicId,
          status: ClinicMembershipStatus.ACTIVE,
        },
      ],
    });
    clinicModel.find.mockReturnValue({
      exec: async () => [
        {
          _id: clinicId,
          name: 'Happy Paws',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const clinics = await service.findMyClinics('user-id');
    expect(clinics).toHaveLength(1);
    expect(clinics[0].name).toBe('Happy Paws');
    expect(clinicModel.find).toHaveBeenCalledWith({
      _id: { $in: [clinicId] },
    });
  });

  it('returns empty myClinics when user has no profile', async () => {
    veterinariansService.findOptionalByUserId.mockResolvedValue(null);
    const clinics = await service.findMyClinics('user-id');
    expect(clinics).toEqual([]);
  });

  describe('isTransactionUnsupportedError', () => {
    it('recognises standalone MongoDB errors, including wrapped ones', () => {
      const wrapped = Object.assign(
        new Error(
          'This MongoDB deployment does not support retryable writes. Please add retryWrites=false to your connection string.',
        ),
        {
          originalError: new Error(
            'Transaction numbers are only allowed on a replica set member or mongos',
          ),
        },
      );
      expect(isTransactionUnsupportedError(wrapped)).toBe(true);
      expect(
        isTransactionUnsupportedError(
          new Error(
            'Transaction numbers are only allowed on a replica set member or mongos',
          ),
        ),
      ).toBe(true);
    });

    it('does not swallow unrelated errors', () => {
      expect(
        isTransactionUnsupportedError(new Error('E11000 duplicate key')),
      ).toBe(false);
      expect(isTransactionUnsupportedError('not an error')).toBe(false);
    });
  });
});
