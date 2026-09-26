import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ClinicPetAccessService } from '../clinic-pet-access/clinic-pet-access.service';
import { ClinicMembershipsService } from '../clinics/clinic-memberships.service';
import { ClinicsService } from '../clinics/clinics.service';
import { OwnerVaccinationsClient } from '../owner-integration/owner-vaccinations.client';
import { OwnerPetsClient } from '../owner-integration/owner-pets.client';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { VaccinationsService } from './vaccinations.service';

describe('VaccinationsService', () => {
  let service: VaccinationsService;

  const clinicPetAccessService = {
    assertUserHasActiveAccessToPet: jest.fn(),
    findActiveAccessForClinicAndPet: jest.fn(),
  };
  const clinicMembershipsService = {
    assertActiveMembership: jest.fn(),
  };
  const clinicsService = {
    findById: jest.fn(),
  };
  const ownerVaccinationsClient = {
    fetchVaccinationsPage: jest.fn(),
    fetchVaccinationById: jest.fn(),
    createVaccination: jest.fn(),
    updateVaccination: jest.fn(),
  };
  const ownerPetsClient = {
    fetchPetsByIds: jest.fn(),
  };
  const veterinariansService = {
    findByUserId: jest.fn(),
  };

  const userId = new Types.ObjectId().toString();
  const clinicA = new Types.ObjectId().toString();
  const petId = new Types.ObjectId().toString();
  const otherPetId = new Types.ObjectId().toString();
  const vaccinationId = new Types.ObjectId().toString();
  const vetProfileId = new Types.ObjectId();

  const patientSummary = {
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
  };

  const baseVaccination = {
    id: vaccinationId,
    petId,
    vaccineName: 'Rabies',
    administeredAt: '2026-09-20T00:00:00.000Z',
    nextDueAt: '2027-09-20T00:00:00.000Z',
    veterinarianName: 'Dr Vet',
    clinicName: 'Clinic A',
    batchNumber: 'LOT-1',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VaccinationsService(
      clinicPetAccessService as unknown as ClinicPetAccessService,
      clinicMembershipsService as unknown as ClinicMembershipsService,
      clinicsService as unknown as ClinicsService,
      ownerVaccinationsClient as unknown as OwnerVaccinationsClient,
      ownerPetsClient as unknown as OwnerPetsClient,
      veterinariansService as unknown as VeterinariansService,
    );
    veterinariansService.findByUserId.mockResolvedValue({
      _id: vetProfileId,
      firstName: 'Dr',
      lastName: 'Vet',
    });
    clinicMembershipsService.assertActiveMembership.mockResolvedValue(undefined);
    ownerPetsClient.fetchPetsByIds.mockResolvedValue([patientSummary]);
  });

  it('returns vaccinations page for an authorized patient', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: clinicA },
    ]);
    ownerVaccinationsClient.fetchVaccinationsPage.mockResolvedValue({
      items: [baseVaccination],
      total: 3,
      page: 1,
      limit: 5,
      totalPages: 1,
      nextDueVaccineName: 'Rabies',
      nextDueAt: '2027-09-20T00:00:00.000Z',
    });

    const page = await service.getVaccinationsPageForPatient(userId, petId, {
      page: 1,
      limit: 5,
    });

    expect(page.items).toHaveLength(1);
    expect(page.nextDueVaccineName).toBe('Rabies');
    expect(ownerVaccinationsClient.fetchVaccinationsPage).toHaveBeenCalledWith(
      petId,
      { page: 1, limit: 5 },
    );
  });

  it('rejects listing vaccinations for an unauthorized patient', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockRejectedValue(
      new ForbiddenException('No access'),
    );

    await expect(
      service.getVaccinationsPageForPatient(userId, otherPetId, {
        page: 1,
        limit: 5,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ownerVaccinationsClient.fetchVaccinationsPage).not.toHaveBeenCalled();
  });

  it('passes search filter to the Owner integration', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: clinicA },
    ]);
    ownerVaccinationsClient.fetchVaccinationsPage.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    await service.getVaccinationsPageForPatient(userId, petId, {
      page: 2,
      limit: 20,
      search: 'rabies',
      upcomingOnly: true,
    });

    expect(ownerVaccinationsClient.fetchVaccinationsPage).toHaveBeenCalledWith(
      petId,
      { page: 2, limit: 20, search: 'rabies', upcomingOnly: true },
    );
  });

  it('creates a vaccination for an authorized patient', async () => {
    clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue({
      petId,
      clinicId: clinicA,
    });
    clinicsService.findById.mockResolvedValue({ name: 'Clinic A' });
    ownerVaccinationsClient.createVaccination.mockResolvedValue(baseVaccination);

    const record = await service.createVaccination(userId, {
      clinicId: clinicA,
      petId,
      vaccineName: 'Rabies',
      administeredAt: new Date('2026-09-20T00:00:00.000Z'),
      nextDueAt: new Date('2027-09-20T00:00:00.000Z'),
    });

    expect(ownerVaccinationsClient.createVaccination).toHaveBeenCalled();
    expect(record.patient.name).toBe('Bella');
  });

  it('rejects creating a vaccination without clinic patient access', async () => {
    clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue(null);

    await expect(
      service.createVaccination(userId, {
        clinicId: clinicA,
        petId,
        vaccineName: 'Rabies',
        administeredAt: new Date(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ownerVaccinationsClient.createVaccination).not.toHaveBeenCalled();
  });

  it('updates an authorized vaccination', async () => {
    ownerVaccinationsClient.fetchVaccinationById.mockResolvedValue(baseVaccination);
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: clinicA },
    ]);
    ownerVaccinationsClient.updateVaccination.mockResolvedValue({
      ...baseVaccination,
      batchNumber: 'LOT-2',
    });

    const record = await service.updateVaccination(userId, vaccinationId, {
      batchNumber: 'LOT-2',
    });

    expect(ownerVaccinationsClient.updateVaccination).toHaveBeenCalled();
    expect(record.batchNumber).toBe('LOT-2');
  });

  it('rejects editing a vaccination when access is revoked', async () => {
    ownerVaccinationsClient.fetchVaccinationById.mockResolvedValue(baseVaccination);
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockRejectedValue(
      new ForbiddenException('No access'),
    );

    await expect(
      service.updateVaccination(userId, vaccinationId, { batchNumber: 'LOT-2' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ownerVaccinationsClient.updateVaccination).not.toHaveBeenCalled();
  });

  it('scopes vaccination fetch to the authorized pet on detail view', async () => {
    ownerVaccinationsClient.fetchVaccinationById.mockResolvedValue({
      ...baseVaccination,
      petId: otherPetId,
    });
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockRejectedValue(
      new ForbiddenException('No access'),
    );

    await expect(
      service.getVaccinationById(userId, vaccinationId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('maps vaccination to the canonical patient', async () => {
    ownerVaccinationsClient.fetchVaccinationById.mockResolvedValue(baseVaccination);
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: clinicA },
    ]);

    const record = await service.getVaccinationById(userId, vaccinationId);

    expect(record.petId).toBe(petId);
    expect(record.patient.id).toBe(petId);
  });

  it('handles Owner service failures safely', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: clinicA },
    ]);
    ownerVaccinationsClient.fetchVaccinationsPage.mockRejectedValue(
      new ServiceUnavailableException('Owner down'),
    );

    await expect(
      service.getVaccinationsPageForPatient(userId, petId, { page: 1, limit: 5 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not expose delete operations', () => {
    expect(
      (service as { deleteVaccination?: unknown }).deleteVaccination,
    ).toBeUndefined();
  });
});
