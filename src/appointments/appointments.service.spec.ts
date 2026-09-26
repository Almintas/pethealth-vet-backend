import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { ClinicPetAccessService } from '../clinic-pet-access/clinic-pet-access.service';
import { ClinicMembershipsService } from '../clinics/clinic-memberships.service';
import { ClinicsService } from '../clinics/clinics.service';
import { OwnerAppointmentsClient } from '../owner-integration/owner-appointments.client';
import { OwnerPetsClient } from '../owner-integration/owner-pets.client';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  const clinicPetAccessService = {
    findActiveAccessForVeterinarianUser: jest.fn(),
    assertUserHasActiveAccessToPet: jest.fn(),
    findActiveAccessForClinicAndPet: jest.fn(),
  };
  const clinicMembershipsService = {
    assertActiveMembership: jest.fn(),
  };
  const clinicsService = {
    findById: jest.fn(),
  };
  const ownerAppointmentsClient = {
    fetchAppointmentsByPetIds: jest.fn(),
    fetchAppointmentById: jest.fn(),
    createAppointment: jest.fn(),
    updateAppointment: jest.fn(),
  };
  const ownerPetsClient = {
    fetchPetsByIds: jest.fn(),
  };
  const veterinariansService = {
    findByUserId: jest.fn(),
  };

  const userId = new Types.ObjectId().toString();
  const clinicA = new Types.ObjectId().toString();
  const clinicB = new Types.ObjectId().toString();
  const petId = new Types.ObjectId().toString();
  const otherPetId = new Types.ObjectId().toString();
  const appointmentId = new Types.ObjectId().toString();
  const vetProfileId = new Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AppointmentsService(
      clinicPetAccessService as unknown as ClinicPetAccessService,
      clinicMembershipsService as unknown as ClinicMembershipsService,
      clinicsService as unknown as ClinicsService,
      ownerAppointmentsClient as unknown as OwnerAppointmentsClient,
      ownerPetsClient as unknown as OwnerPetsClient,
      veterinariansService as unknown as VeterinariansService,
    );
    veterinariansService.findByUserId.mockResolvedValue({
      _id: vetProfileId,
      firstName: 'Dr',
      lastName: 'Vet',
    });
    clinicMembershipsService.assertActiveMembership.mockResolvedValue(undefined);
    ownerPetsClient.fetchPetsByIds.mockResolvedValue([
      {
        id: petId,
        name: 'Bella',
        species: 'Dog',
        breed: 'Labrador',
        owner: {
          id: 'owner-1',
          firstName: 'Jonas',
          lastName: 'Jonaitis',
          email: 'jonas@example.com',
        },
      },
    ]);
  });

  it('lists authorized appointments for accessible pets and clinics', async () => {
    clinicPetAccessService.findActiveAccessForVeterinarianUser.mockResolvedValue([
      { petId, clinicId: new Types.ObjectId(clinicA) },
    ]);
    ownerAppointmentsClient.fetchAppointmentsByPetIds.mockResolvedValue([
      {
        id: appointmentId,
        petId,
        scheduledAt: new Date().toISOString(),
        type: 'CHECKUP',
        vetClinicId: clinicA,
        status: AppointmentStatus.SCHEDULED,
      },
      {
        id: 'other-clinic',
        petId,
        scheduledAt: new Date().toISOString(),
        type: 'CHECKUP',
        vetClinicId: clinicB,
        status: AppointmentStatus.SCHEDULED,
      },
    ]);

    const appointments = await service.getMyAppointments(userId);

    expect(appointments).toHaveLength(1);
    expect(appointments[0]?.id).toBe(appointmentId);
    expect(appointments[0]?.patient.name).toBe('Bella');
  });

  it('rejects creating an appointment without clinic patient access', async () => {
    clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue(null);

    await expect(
      service.createAppointment(userId, {
        clinicId: clinicA,
        petId,
        scheduledAt: new Date(),
        type: 'CHECKUP',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ownerAppointmentsClient.createAppointment).not.toHaveBeenCalled();
  });

  it('returns a newly created appointment when listing the schedule', async () => {
    const scheduledAt = new Date('2026-09-26T12:00:00.000Z');
    clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue({
      petId,
      clinicId: clinicA,
    });
    clinicsService.findById.mockResolvedValue({ name: 'Clinic A' });
    ownerAppointmentsClient.createAppointment.mockResolvedValue({
      id: appointmentId,
      petId,
      scheduledAt: scheduledAt.toISOString(),
      type: 'CHECKUP',
      vetClinicId: clinicA,
      status: AppointmentStatus.SCHEDULED,
      clinicName: 'Clinic A',
      veterinarianName: 'Dr Vet',
    });
    clinicPetAccessService.findActiveAccessForVeterinarianUser.mockResolvedValue([
      { petId, clinicId: new Types.ObjectId(clinicA) },
    ]);

    await service.createAppointment(userId, {
      clinicId: clinicA,
      petId,
      scheduledAt,
      type: 'CHECKUP',
    });

    ownerAppointmentsClient.fetchAppointmentsByPetIds.mockResolvedValue([
      {
        id: appointmentId,
        petId: ` ${petId} `,
        scheduledAt: scheduledAt.toISOString(),
        type: 'CHECKUP',
        vetClinicId: ` ${clinicA} `,
        status: AppointmentStatus.SCHEDULED,
      },
    ]);

    const appointments = await service.getMyAppointments(userId);

    expect(appointments).toHaveLength(1);
    expect(appointments[0]?.id).toBe(appointmentId);
    expect(appointments[0]?.scheduledAt.toISOString()).toBe(scheduledAt.toISOString());
  });

  it('creates an appointment for an authorized patient', async () => {
    clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue({
      petId,
      clinicId: clinicA,
    });
    clinicsService.findById.mockResolvedValue({ name: 'Clinic A' });
    ownerAppointmentsClient.createAppointment.mockResolvedValue({
      id: appointmentId,
      petId,
      scheduledAt: new Date().toISOString(),
      type: 'CHECKUP',
      vetClinicId: clinicA,
      status: AppointmentStatus.SCHEDULED,
      clinicName: 'Clinic A',
      veterinarianName: 'Dr Vet',
    });
    clinicPetAccessService.findActiveAccessForVeterinarianUser.mockResolvedValue([
      { petId, clinicId: new Types.ObjectId(clinicA) },
    ]);

    const appointment = await service.createAppointment(userId, {
      clinicId: clinicA,
      petId,
      scheduledAt: new Date(),
      type: 'CHECKUP',
      reason: 'Annual check',
    });

    expect(ownerAppointmentsClient.createAppointment).toHaveBeenCalled();
    expect(appointment.patient.name).toBe('Bella');
  });

  it('rejects editing an appointment from another clinic', async () => {
    ownerAppointmentsClient.fetchAppointmentById.mockResolvedValue({
      id: appointmentId,
      petId,
      scheduledAt: new Date().toISOString(),
      type: 'CHECKUP',
      vetClinicId: clinicB,
      status: AppointmentStatus.SCHEDULED,
    });
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: new Types.ObjectId(clinicA) },
    ]);
    clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue(null);

    await expect(
      service.updateAppointment(userId, appointmentId, { type: 'ILLNESS' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marks an appointment as completed', async () => {
    ownerAppointmentsClient.fetchAppointmentById.mockResolvedValue({
      id: appointmentId,
      petId,
      scheduledAt: new Date().toISOString(),
      type: 'CHECKUP',
      vetClinicId: clinicA,
      status: AppointmentStatus.SCHEDULED,
    });
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: new Types.ObjectId(clinicA) },
    ]);
    clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue({
      petId,
      clinicId: clinicA,
    });
    ownerAppointmentsClient.updateAppointment.mockResolvedValue({
      id: appointmentId,
      petId,
      scheduledAt: new Date().toISOString(),
      type: 'CHECKUP',
      vetClinicId: clinicA,
      status: AppointmentStatus.COMPLETED,
    });
    clinicPetAccessService.findActiveAccessForVeterinarianUser.mockResolvedValue([
      { petId, clinicId: new Types.ObjectId(clinicA) },
    ]);

    const appointment = await service.updateAppointment(userId, appointmentId, {
      status: AppointmentStatus.COMPLETED,
    });

    expect(appointment.status).toBe(AppointmentStatus.COMPLETED);
  });

  it('cancels an appointment using CANCELLED status', async () => {
    ownerAppointmentsClient.fetchAppointmentById.mockResolvedValue({
      id: appointmentId,
      petId,
      scheduledAt: new Date().toISOString(),
      type: 'CHECKUP',
      vetClinicId: clinicA,
      status: AppointmentStatus.SCHEDULED,
    });
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: new Types.ObjectId(clinicA) },
    ]);
    clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue({
      petId,
      clinicId: clinicA,
    });
    ownerAppointmentsClient.updateAppointment.mockResolvedValue({
      id: appointmentId,
      petId,
      scheduledAt: new Date().toISOString(),
      type: 'CHECKUP',
      vetClinicId: clinicA,
      status: AppointmentStatus.CANCELLED,
    });
    clinicPetAccessService.findActiveAccessForVeterinarianUser.mockResolvedValue([
      { petId, clinicId: new Types.ObjectId(clinicA) },
    ]);

    const appointment = await service.cancelAppointment(userId, appointmentId);

    expect(ownerAppointmentsClient.updateAppointment).toHaveBeenCalledWith(
      appointmentId,
      { status: AppointmentStatus.CANCELLED },
    );
    expect(appointment.status).toBe(AppointmentStatus.CANCELLED);
  });

  it('does not expose hard delete operations', () => {
    expect(
      (service as { deleteAppointment?: unknown }).deleteAppointment,
    ).toBeUndefined();
  });

  it('returns appointments inside the requested schedule day window', async () => {
    const scheduledAt = new Date('2026-09-26T11:30:00.000Z');
    clinicPetAccessService.findActiveAccessForVeterinarianUser.mockResolvedValue([
      { petId, clinicId: new Types.ObjectId(clinicA) },
    ]);
    ownerAppointmentsClient.fetchAppointmentsByPetIds.mockResolvedValue([
      {
        id: appointmentId,
        petId,
        scheduledAt: scheduledAt.toISOString(),
        type: 'CHECKUP',
        vetClinicId: clinicA,
        status: AppointmentStatus.SCHEDULED,
      },
    ]);
    const scheduledFrom = new Date('2026-09-25T21:00:00.000Z');
    const scheduledTo = new Date('2026-09-26T20:59:59.999Z');

    const appointments = await service.getMyAppointments(userId, {
      scheduledFrom,
      scheduledTo,
    });

    expect(ownerAppointmentsClient.fetchAppointmentsByPetIds).toHaveBeenCalledWith(
      [petId],
      scheduledFrom.toISOString(),
      scheduledTo.toISOString(),
    );
    expect(appointments).toHaveLength(1);
    expect(appointments[0]?.id).toBe(appointmentId);
  });

  it('passes schedule window to owner when listing appointments', async () => {
    clinicPetAccessService.findActiveAccessForVeterinarianUser.mockResolvedValue([
      { petId, clinicId: new Types.ObjectId(clinicA) },
    ]);
    ownerAppointmentsClient.fetchAppointmentsByPetIds.mockResolvedValue([]);
    const scheduledFrom = new Date('2026-09-26T00:00:00.000Z');
    const scheduledTo = new Date('2026-09-26T23:59:59.999Z');

    await service.getMyAppointments(userId, { scheduledFrom, scheduledTo });

    expect(ownerAppointmentsClient.fetchAppointmentsByPetIds).toHaveBeenCalledWith(
      [petId],
      scheduledFrom.toISOString(),
      scheduledTo.toISOString(),
    );
  });

  it('lists patient appointments only for authorized patient', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue(undefined);
    clinicPetAccessService.findActiveAccessForVeterinarianUser.mockResolvedValue([
      { petId, clinicId: new Types.ObjectId(clinicA) },
    ]);
    ownerAppointmentsClient.fetchAppointmentsByPetIds.mockResolvedValue([
      {
        id: appointmentId,
        petId,
        scheduledAt: new Date().toISOString(),
        type: 'CHECKUP',
        vetClinicId: clinicA,
        status: AppointmentStatus.SCHEDULED,
      },
    ]);

    const appointments = await service.getPatientAppointments(userId, petId);

    expect(appointments).toHaveLength(1);
    expect(ownerAppointmentsClient.fetchAppointmentsByPetIds).toHaveBeenCalledWith(
      [petId],
      expect.any(String),
      expect.any(String),
    );
  });

  it('rejects patient appointments for unauthorized patient', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue(undefined);
    clinicPetAccessService.findActiveAccessForVeterinarianUser.mockResolvedValue([
      { petId, clinicId: new Types.ObjectId(clinicA) },
    ]);

    await expect(
      service.getPatientAppointments(userId, otherPetId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
