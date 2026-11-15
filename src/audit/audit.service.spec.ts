import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Types } from 'mongoose';
import { AuditService } from './audit.service';
import {
  AuditAction,
  AuditActorType,
  AuditEntityType,
} from './enums/audit.enums';

const execOf = (value: unknown) => ({
  exec: jest.fn<() => Promise<unknown>>().mockResolvedValue(value),
});

describe('AuditService', () => {
  const userId = new Types.ObjectId();
  const profileId = new Types.ObjectId();
  const clinicId = new Types.ObjectId();
  const petId = 'owner-pet-1';

  const auditModel = {
    exists: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
  };
  const profileModel = { findOne: jest.fn() };
  const membershipModel = { find: jest.fn() };
  const accessModel = { findOne: jest.fn() };
  const clinicModel = { findById: jest.fn() };

  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(
      auditModel as never,
      profileModel as never,
      membershipModel as never,
      accessModel as never,
      clinicModel as never,
    );
    auditModel.exists.mockReturnValue(execOf(null));
    auditModel.create.mockResolvedValue({} as never);
    profileModel.findOne.mockReturnValue(
      execOf({ _id: profileId, firstName: 'Ona', lastName: 'Vet' }),
    );
    clinicModel.findById.mockReturnValue(
      execOf({ _id: clinicId, name: 'Paws Clinic' }),
    );
  });

  it('records a clinic change with actor and clinic name snapshots', async () => {
    await service.recordClinicActivity({
      actorUserId: userId.toString(),
      petId,
      clinicId: clinicId.toString(),
      action: AuditAction.CREATED,
      entityType: AuditEntityType.VACCINATION,
      entityId: 'vacc-1',
      summary: 'Rabies',
    });

    expect(auditModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        petId,
        actorType: AuditActorType.CLINIC_USER,
        actorName: 'Ona Vet',
        clinicName: 'Paws Clinic',
        action: AuditAction.CREATED,
        entityType: AuditEntityType.VACCINATION,
        entityId: 'vacc-1',
        summary: 'Rabies',
      }),
    );
    expect(auditModel.exists).not.toHaveBeenCalled();
  });

  it('resolves the clinic from the actor access when none is given', async () => {
    membershipModel.find.mockReturnValue(execOf([{ clinicId }]));
    accessModel.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue(execOf({ clinicId })),
    });

    await service.recordClinicActivity({
      actorUserId: userId.toString(),
      petId,
      action: AuditAction.UPDATED,
      entityType: AuditEntityType.MEDICAL_RECORD,
    });

    expect(accessModel.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ petId }),
    );
    expect(auditModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId, clinicName: 'Paws Clinic' }),
    );
  });

  it('logs repeated views of the same pet only once per window', async () => {
    auditModel.exists.mockReturnValue(execOf({ _id: new Types.ObjectId() }));

    await service.recordClinicActivity({
      actorUserId: userId.toString(),
      petId,
      action: AuditAction.VIEWED,
      entityType: AuditEntityType.PATIENT,
    });

    expect(auditModel.create).not.toHaveBeenCalled();
  });

  it('logs a first view', async () => {
    membershipModel.find.mockReturnValue(execOf([]));

    await service.recordClinicActivity({
      actorUserId: userId.toString(),
      petId,
      action: AuditAction.VIEWED,
      entityType: AuditEntityType.PATIENT,
    });

    expect(auditModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.VIEWED, clinicId: null }),
    );
  });

  it('never throws when writing the event fails', async () => {
    auditModel.create.mockRejectedValue(new Error('db down') as never);

    await expect(
      service.recordClinicActivity({
        actorUserId: userId.toString(),
        petId,
        clinicId: clinicId.toString(),
        action: AuditAction.CREATED,
        entityType: AuditEntityType.MEDICATION,
      }),
    ).resolves.toBeUndefined();
  });

  it('records owner revocations without a clinic user', async () => {
    await service.recordOwnerActivity({
      petId,
      clinicId: clinicId.toString(),
      action: AuditAction.ACCESS_REVOKED,
    });

    expect(auditModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: AuditActorType.OWNER,
        actorUserId: null,
        clinicName: 'Paws Clinic',
        action: AuditAction.ACCESS_REVOKED,
      }),
    );
  });

  it('caps the number of events returned', async () => {
    const exec = jest.fn<() => Promise<unknown>>().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ exec });
    const sort = jest.fn().mockReturnValue({ limit });
    auditModel.find.mockReturnValue({ sort });

    await service.listForPet(petId, 10_000);

    expect(auditModel.find).toHaveBeenCalledWith({ petId });
    expect(limit).toHaveBeenCalledWith(200);
  });
});
