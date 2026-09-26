import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ClinicPetAccessService } from '../clinic-pet-access/clinic-pet-access.service';
import { ClinicMembershipsService } from '../clinics/clinic-memberships.service';
import { ClinicsService } from '../clinics/clinics.service';
import { OwnerMedicationsClient } from '../owner-integration/owner-medications.client';
import { OwnerPetsClient } from '../owner-integration/owner-pets.client';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { MedicationsService } from './medications.service';

describe('MedicationsService', () => {
  let service: MedicationsService;

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
  const ownerMedicationsClient = {
    fetchMedicationsPage: jest.fn(),
    fetchMedicationById: jest.fn(),
    createMedication: jest.fn(),
    updateMedication: jest.fn(),
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
  const medicationId = new Types.ObjectId().toString();
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

  const baseMedication = {
    id: medicationId,
    petId,
    name: 'Amoxicillin',
    dosage: 250,
    dosageUnit: 'mg',
    frequency: 'Twice daily',
    startDate: '2026-09-20T00:00:00.000Z',
    isActive: true,
    veterinarianName: 'Dr Vet',
    clinicName: 'Clinic A',
    notes: 'With food',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MedicationsService(
      clinicPetAccessService as unknown as ClinicPetAccessService,
      clinicMembershipsService as unknown as ClinicMembershipsService,
      clinicsService as unknown as ClinicsService,
      ownerMedicationsClient as unknown as OwnerMedicationsClient,
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

  it('returns active medications page for an authorized patient', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: clinicA },
    ]);
    ownerMedicationsClient.fetchMedicationsPage.mockResolvedValue({
      items: [baseMedication],
      total: 3,
      page: 1,
      limit: 5,
      totalPages: 1,
      activeTotal: 2,
    });

    const page = await service.getMedicationsPageForPatient(userId, petId, {
      page: 1,
      limit: 5,
      isActive: true,
    });

    expect(page.items).toHaveLength(1);
    expect(page.activeTotal).toBe(2);
    expect(ownerMedicationsClient.fetchMedicationsPage).toHaveBeenCalledWith(
      petId,
      { page: 1, limit: 5, isActive: true },
    );
  });

  it('rejects listing medications for an unauthorized patient', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockRejectedValue(
      new ForbiddenException('No access'),
    );

    await expect(
      service.getMedicationsPageForPatient(userId, otherPetId, {
        page: 1,
        limit: 5,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ownerMedicationsClient.fetchMedicationsPage).not.toHaveBeenCalled();
  });

  it('passes search filter to the Owner integration', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: clinicA },
    ]);
    ownerMedicationsClient.fetchMedicationsPage.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      activeTotal: 0,
    });

    await service.getMedicationsPageForPatient(userId, petId, {
      page: 2,
      limit: 20,
      search: 'amox',
    });

    expect(ownerMedicationsClient.fetchMedicationsPage).toHaveBeenCalledWith(
      petId,
      { page: 2, limit: 20, search: 'amox' },
    );
  });

  it('creates a medication for an authorized patient', async () => {
    clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue({
      petId,
      clinicId: clinicA,
    });
    clinicsService.findById.mockResolvedValue({ name: 'Clinic A' });
    ownerMedicationsClient.createMedication.mockResolvedValue(baseMedication);

    const medication = await service.createMedication(userId, {
      clinicId: clinicA,
      petId,
      name: 'Amoxicillin',
      dosage: 250,
      dosageUnit: 'mg',
      frequency: 'Twice daily',
      startDate: new Date('2026-09-20T00:00:00.000Z'),
      notes: 'With food',
    });

    expect(ownerMedicationsClient.createMedication).toHaveBeenCalled();
    expect(medication.patient.name).toBe('Bella');
    expect(medication.isActive).toBe(true);
  });

  it('rejects creating a medication without clinic patient access', async () => {
    clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue(null);

    await expect(
      service.createMedication(userId, {
        clinicId: clinicA,
        petId,
        name: 'Amoxicillin',
        dosage: 250,
        dosageUnit: 'mg',
        frequency: 'Twice daily',
        startDate: new Date(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ownerMedicationsClient.createMedication).not.toHaveBeenCalled();
  });

  it('updates an authorized medication', async () => {
    ownerMedicationsClient.fetchMedicationById.mockResolvedValue(baseMedication);
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: clinicA },
    ]);
    ownerMedicationsClient.updateMedication.mockResolvedValue({
      ...baseMedication,
      frequency: 'Once daily',
    });

    const medication = await service.updateMedication(userId, medicationId, {
      frequency: 'Once daily',
    });

    expect(ownerMedicationsClient.updateMedication).toHaveBeenCalled();
    expect(medication.frequency).toBe('Once daily');
  });

  it('rejects editing a medication when access is revoked', async () => {
    ownerMedicationsClient.fetchMedicationById.mockResolvedValue(baseMedication);
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockRejectedValue(
      new ForbiddenException('No access'),
    );

    await expect(
      service.updateMedication(userId, medicationId, { frequency: 'Updated' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ownerMedicationsClient.updateMedication).not.toHaveBeenCalled();
  });

  it('stops a medication without deleting history', async () => {
    ownerMedicationsClient.fetchMedicationById.mockResolvedValue(baseMedication);
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: clinicA },
    ]);
    ownerMedicationsClient.updateMedication.mockResolvedValue({
      ...baseMedication,
      isActive: false,
      endDate: '2026-09-26T00:00:00.000Z',
    });

    const medication = await service.updateMedication(userId, medicationId, {
      isActive: false,
      endDate: new Date('2026-09-26T00:00:00.000Z'),
    });

    expect(ownerMedicationsClient.updateMedication).toHaveBeenCalledWith(
      medicationId,
      expect.objectContaining({ isActive: false }),
    );
    expect(medication.isActive).toBe(false);
  });

  it('scopes medication fetch to the authorized pet on detail view', async () => {
    ownerMedicationsClient.fetchMedicationById.mockResolvedValue({
      ...baseMedication,
      petId: otherPetId,
    });
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockRejectedValue(
      new ForbiddenException('No access'),
    );

    await expect(
      service.getMedicationById(userId, medicationId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('maps medication to the canonical patient', async () => {
    ownerMedicationsClient.fetchMedicationById.mockResolvedValue(baseMedication);
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: clinicA },
    ]);

    const medication = await service.getMedicationById(userId, medicationId);

    expect(medication.petId).toBe(petId);
    expect(medication.patient.id).toBe(petId);
  });

  it('handles Owner service failures safely', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: clinicA },
    ]);
    ownerMedicationsClient.fetchMedicationsPage.mockRejectedValue(
      new ServiceUnavailableException('Owner down'),
    );

    await expect(
      service.getMedicationsPageForPatient(userId, petId, { page: 1, limit: 5 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not expose delete operations', () => {
    expect(
      (service as { deleteMedication?: unknown }).deleteMedication,
    ).toBeUndefined();
  });
});
