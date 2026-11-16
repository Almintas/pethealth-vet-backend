import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ClinicPetAccessService } from '../clinic-pet-access/clinic-pet-access.service';
import { ClinicMembershipsService } from '../clinics/clinic-memberships.service';
import { ClinicsService } from '../clinics/clinics.service';
import { OwnerRemindersClient } from '../owner-integration/owner-reminders.client';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { RemindersService } from './reminders.service';

describe('RemindersService (clinic)', () => {
  const userId = new Types.ObjectId().toString();
  const clinicId = new Types.ObjectId().toString();
  const petId = new Types.ObjectId().toString();

  const clinicPetAccessService = {
    assertUserHasActiveAccessToPet: jest.fn<() => Promise<unknown>>(),
    findActiveAccessForClinicAndPet: jest.fn<() => Promise<unknown>>(),
  };
  const clinicMembershipsService = {
    assertActiveMembership: jest.fn<() => Promise<unknown>>(),
  };
  const clinicsService = { findById: jest.fn<() => Promise<unknown>>() };
  const veterinariansService = {
    findByUserId: jest.fn<() => Promise<unknown>>(),
  };
  const ownerRemindersClient = {
    listForPet: jest.fn<() => Promise<unknown>>(),
    create: jest.fn<(payload: unknown) => Promise<unknown>>(),
    delete: jest.fn<() => Promise<unknown>>(),
  };

  const ownerReminder = {
    id: 'r1',
    petId,
    type: 'APPOINTMENT',
    title: 'Follow-up visit',
    message: null,
    dueAt: '2026-12-10T09:00:00.000Z',
    status: 'PENDING',
    managedBy: 'CLINIC',
    clinicId,
    clinicName: 'Paws',
    createdByName: 'Ona Vet',
    createdAt: '2026-11-16T10:00:00.000Z',
  };

  let service: RemindersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RemindersService(
      clinicPetAccessService as unknown as ClinicPetAccessService,
      clinicMembershipsService as unknown as ClinicMembershipsService,
      clinicsService as unknown as ClinicsService,
      veterinariansService as unknown as VeterinariansService,
      ownerRemindersClient as unknown as OwnerRemindersClient,
    );
    veterinariansService.findByUserId.mockResolvedValue({
      _id: new Types.ObjectId(),
      firstName: 'Ona',
      lastName: 'Vet',
    });
    clinicMembershipsService.assertActiveMembership.mockResolvedValue(
      undefined,
    );
    clinicsService.findById.mockResolvedValue({ name: 'Paws' });
  });

  it('sets a reminder for the owner on behalf of the clinic', async () => {
    clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue({
      petId,
    });
    ownerRemindersClient.create.mockResolvedValue(ownerReminder);

    const reminder = await service.create(userId, {
      clinicId,
      petId,
      type: 'APPOINTMENT',
      title: 'Follow-up visit',
      message: '',
      dueAt: new Date('2026-12-10T09:00:00.000Z'),
    });

    expect(ownerRemindersClient.create).toHaveBeenCalledWith({
      petId,
      type: 'APPOINTMENT',
      title: 'Follow-up visit',
      message: undefined,
      dueAt: '2026-12-10T09:00:00.000Z',
      clinicId,
      clinicName: 'Paws',
      createdByName: 'Ona Vet',
    });
    expect(reminder.dueAt).toEqual(new Date('2026-12-10T09:00:00.000Z'));
  });

  it('refuses without access at the clinic', async () => {
    clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue(
      null,
    );

    await expect(
      service.create(userId, {
        clinicId,
        petId,
        type: 'GENERAL',
        title: 'Call us',
        dueAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ownerRemindersClient.create).not.toHaveBeenCalled();
  });

  it('lists reminders only with access to the patient', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockRejectedValue(
      new ForbiddenException('No access'),
    );

    await expect(service.listForPatient(userId, petId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(ownerRemindersClient.listForPet).not.toHaveBeenCalled();
  });

  it('removes a reminder for the clinic and patient', async () => {
    clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue({
      petId,
    });
    ownerRemindersClient.delete.mockResolvedValue(ownerReminder);

    await service.delete(userId, 'r1', clinicId, petId);

    expect(ownerRemindersClient.delete).toHaveBeenCalledWith(
      'r1',
      clinicId,
      petId,
    );
  });
});
