import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ClinicMembershipStatus } from '../common/enums/clinic-membership-status.enum';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { ClinicMembershipsService } from './clinic-memberships.service';
import { ClinicMembership } from './schemas/clinic-membership.schema';
import { ClinicsService } from './clinics.service';

describe('ClinicMembershipsService', () => {
  let service: ClinicMembershipsService;
  const save = jest.fn();
  const membershipModel = jest.fn().mockImplementation((data) => ({
    ...data,
    save,
  })) as jest.Mock & {
    findOne: jest.Mock;
    find: jest.Mock;
    findById: jest.Mock;
  };
  membershipModel.findOne = jest.fn();
  membershipModel.find = jest.fn();
  membershipModel.findById = jest.fn();

  const clinicsService = { findById: jest.fn() };
  const veterinariansService = { findById: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicMembershipsService,
        {
          provide: getModelToken(ClinicMembership.name),
          useValue: membershipModel,
        },
        { provide: ClinicsService, useValue: clinicsService },
        { provide: VeterinariansService, useValue: veterinariansService },
      ],
    }).compile();

    service = module.get(ClinicMembershipsService);
  });

  it('denies access without active membership', async () => {
    membershipModel.findOne.mockResolvedValue(null);
    const profileId = new Types.ObjectId().toString();
    const clinicId = new Types.ObjectId().toString();

    await expect(
      service.assertActiveMembership(profileId, clinicId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows access with active membership', async () => {
    membershipModel.findOne.mockResolvedValue({
      status: ClinicMembershipStatus.ACTIVE,
    });
    const profileId = new Types.ObjectId().toString();
    const clinicId = new Types.ObjectId().toString();

    await expect(
      service.assertActiveMembership(profileId, clinicId),
    ).resolves.toBeUndefined();
  });

  it('prevents duplicate membership creation', async () => {
    const profileId = new Types.ObjectId().toString();
    const clinicId = new Types.ObjectId().toString();
    veterinariansService.findById.mockResolvedValue({ _id: profileId });
    clinicsService.findById.mockResolvedValue({ _id: clinicId });
    membershipModel.findOne.mockResolvedValue({ _id: 'existing' });

    await expect(
      service.addMembership({
        veterinarianProfileId: profileId,
        clinicId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
