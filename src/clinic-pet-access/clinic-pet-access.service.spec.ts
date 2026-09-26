import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ClinicPetAccessStatus } from '../common/enums/clinic-pet-access-status.enum';
import { ClinicMembershipsService } from '../clinics/clinic-memberships.service';
import { ClinicsService } from '../clinics/clinics.service';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { ClinicPetAccessService } from './clinic-pet-access.service';
import { ClinicPetAccess } from './schemas/clinic-pet-access.schema';

describe('ClinicPetAccessService', () => {
  let service: ClinicPetAccessService;

  const save = jest.fn();
  const accessModel = jest.fn().mockImplementation((data) => ({
    ...data,
    _id: new Types.ObjectId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    save,
  })) as jest.Mock & {
    findOne: jest.Mock;
    find: jest.Mock;
  };
  accessModel.findOne = jest.fn();
  accessModel.find = jest.fn();

  const clinicMembershipsService = {
    assertActiveMembership: jest.fn(),
    listClinicsForVeterinarian: jest.fn(),
  };
  const clinicsService = { findById: jest.fn() };
  const veterinariansService = {
    findOptionalByUserId: jest.fn(),
    findByUserId: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicPetAccessService,
        {
          provide: getModelToken(ClinicPetAccess.name),
          useValue: accessModel,
        },
        {
          provide: ClinicMembershipsService,
          useValue: clinicMembershipsService,
        },
        { provide: ClinicsService, useValue: clinicsService },
        { provide: VeterinariansService, useValue: veterinariansService },
      ],
    }).compile();

    service = module.get(ClinicPetAccessService);
  });

  it('finds active access for clinic and pet', async () => {
    const clinicId = new Types.ObjectId().toString();
    const petId = 'owner-pet-123';
    const doc = { status: ClinicPetAccessStatus.ACTIVE, petId };
    accessModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(doc) });

    const result = await service.findActiveAccessForClinicAndPet(clinicId, petId);

    expect(result).toBe(doc);
    expect(accessModel.findOne).toHaveBeenCalledWith({
      clinicId: new Types.ObjectId(clinicId),
      petId,
      status: ClinicPetAccessStatus.ACTIVE,
    });
  });

  it('does not treat revoked access as active', async () => {
    accessModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

    const hasAccess = await service.hasActiveAccess(
      new Types.ObjectId().toString(),
      'owner-pet-123',
    );

    expect(hasAccess).toBe(false);
  });

  it('prevents duplicate active clinic and pet access', async () => {
    const clinicId = new Types.ObjectId().toString();
    const petId = 'owner-pet-123';
    clinicsService.findById.mockResolvedValue({ _id: clinicId });
    accessModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ status: ClinicPetAccessStatus.ACTIVE }),
    });

    await expect(
      service.grantActiveAccess({ clinicId, petId }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('revoke requires active membership for the clinic', async () => {
    const userId = new Types.ObjectId().toString();
    const profileId = new Types.ObjectId().toString();
    const clinicId = new Types.ObjectId().toString();

    veterinariansService.findByUserId.mockResolvedValue({ _id: profileId });
    clinicMembershipsService.assertActiveMembership.mockRejectedValue(
      new ForbiddenException('No active membership for this clinic'),
    );

    await expect(
      service.revokeAccessForUser(userId, clinicId, 'owner-pet-123'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('myPatientAccess only returns access for clinics with active membership', async () => {
    const userId = new Types.ObjectId().toString();
    const profileId = new Types.ObjectId();
    const allowedClinicId = new Types.ObjectId();
    const otherClinicId = new Types.ObjectId();

    veterinariansService.findOptionalByUserId.mockResolvedValue({
      _id: profileId,
    });
    clinicMembershipsService.listClinicsForVeterinarian.mockResolvedValue([
      { clinicId: allowedClinicId },
    ]);

    const allowedAccess = {
      _id: new Types.ObjectId(),
      petId: 'pet-allowed',
      clinicId: allowedClinicId,
      status: ClinicPetAccessStatus.ACTIVE,
      grantedAt: new Date(),
      revokedAt: null,
      grantedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    accessModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([allowedAccess]),
      }),
    });

    clinicsService.findById.mockImplementation(async (id: string) => ({
      _id: new Types.ObjectId(id),
      name: 'Clinic',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const results = await service.findMyPatientAccess(userId);

    expect(accessModel.find).toHaveBeenCalledWith({
      clinicId: { $in: [allowedClinicId] },
      status: ClinicPetAccessStatus.ACTIVE,
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.petId).toBe('pet-allowed');
    expect(results[0]?.clinicId).toBe(allowedClinicId.toString());
    expect(otherClinicId.toString()).not.toBe(results[0]?.clinicId);
  });

  it('revoking access sets status to REVOKED and revokedAt', async () => {
    const userId = new Types.ObjectId().toString();
    const profileId = new Types.ObjectId().toString();
    const clinicId = new Types.ObjectId().toString();
    const petId = 'owner-pet-123';
    const revokedAt = new Date('2026-01-02T00:00:00.000Z');

    const accessDoc = {
      _id: new Types.ObjectId(),
      petId,
      clinicId: new Types.ObjectId(clinicId),
      status: ClinicPetAccessStatus.ACTIVE,
      grantedAt: new Date('2026-01-01T00:00:00.000Z'),
      revokedAt: null,
      grantedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      save: jest.fn().mockImplementation(async function saveAccess(this: {
        status: ClinicPetAccessStatus;
        revokedAt: Date | null;
      }) {
        this.status = ClinicPetAccessStatus.REVOKED;
        this.revokedAt = revokedAt;
        return this;
      }),
    };

    veterinariansService.findByUserId.mockResolvedValue({ _id: profileId });
    clinicMembershipsService.assertActiveMembership.mockResolvedValue(undefined);
    accessModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(accessDoc),
    });
    clinicsService.findById.mockResolvedValue({
      _id: new Types.ObjectId(clinicId),
      name: 'Test Clinic',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.revokeAccessForUser(userId, clinicId, petId);

    expect(accessDoc.save).toHaveBeenCalled();
    expect(result.status).toBe(ClinicPetAccessStatus.REVOKED);
    expect(result.revokedAt).toEqual(revokedAt);
  });
});
