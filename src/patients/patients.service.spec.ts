import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ClinicPetAccessStatus } from '../common/enums/clinic-pet-access-status.enum';
import { ClinicMembershipsService } from '../clinics/clinic-memberships.service';
import { ClinicsService } from '../clinics/clinics.service';
import { ClinicPetAccessService } from '../clinic-pet-access/clinic-pet-access.service';
import { OwnerPetsClient } from '../owner-integration/owner-pets.client';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { PatientsService } from './patients.service';

describe('PatientsService', () => {
  let service: PatientsService;

  const clinicPetAccessService = {
    findActiveAccessForVeterinarianUser: jest.fn(),
    assertUserHasActiveAccessToPet: jest.fn(),
    grantActiveAccess: jest.fn(),
  };
  const ownerPetsClient = {
    fetchPetsByIds: jest.fn(),
    registerPetForVet: jest.fn(),
    updatePetForVet: jest.fn(),
    updateOwnerProfileForVet: jest.fn(),
    redeemPetShareCode: jest.fn(),
  };
  const veterinariansService = {
    findByUserId: jest.fn(),
  };
  const clinicMembershipsService = {
    assertActiveMembership: jest.fn(),
  };
  const clinicsService = {
    findById: jest.fn(),
  };

  const userId = new Types.ObjectId().toString();
  const vetProfileId = new Types.ObjectId();
  const clinicA = new Types.ObjectId();
  const clinicB = new Types.ObjectId();
  const petId = new Types.ObjectId().toString();

  const ownerPet = {
    id: petId,
    name: 'Luna',
    species: 'Cat',
    breed: 'Mixed',
    gender: 'Female',
    birthDate: '2020-05-01T00:00:00.000Z',
    owner: {
      id: 'owner-1',
      firstName: 'Jane',
      lastName: 'Owner',
      email: 'jane@example.com',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PatientsService(
      clinicPetAccessService as unknown as ClinicPetAccessService,
      ownerPetsClient as unknown as OwnerPetsClient,
      veterinariansService as unknown as VeterinariansService,
      clinicMembershipsService as unknown as ClinicMembershipsService,
      clinicsService as unknown as ClinicsService,
    );
    veterinariansService.findByUserId.mockResolvedValue({ _id: vetProfileId });
    clinicsService.findById.mockResolvedValue({ name: 'Paws Clinic' } as never);
    clinicMembershipsService.assertActiveMembership.mockResolvedValue(
      undefined,
    );
  });

  it('returns authorized patients with mapped owner pet data', async () => {
    const grantedAt = new Date('2026-01-01T00:00:00.000Z');
    clinicPetAccessService.findActiveAccessForVeterinarianUser.mockResolvedValue(
      [
        {
          petId,
          clinicId: clinicA,
          status: ClinicPetAccessStatus.ACTIVE,
          grantedAt,
        },
      ],
    );
    ownerPetsClient.fetchPetsByIds.mockResolvedValue([ownerPet]);

    const patients = await service.getMyPatients(userId);

    expect(ownerPetsClient.fetchPetsByIds).toHaveBeenCalledWith([petId]);
    expect(patients).toHaveLength(1);
    expect(patients[0]?.name).toBe('Luna');
    expect(patients[0]?.clinicAccesses[0]?.clinicId).toBe(clinicA.toString());
  });

  it('returns no patients without active clinic membership access records', async () => {
    clinicPetAccessService.findActiveAccessForVeterinarianUser.mockResolvedValue(
      [],
    );

    const patients = await service.getMyPatients(userId);

    expect(patients).toEqual([]);
    expect(ownerPetsClient.fetchPetsByIds).not.toHaveBeenCalled();
  });

  it('deduplicates the same pet across multiple clinics', async () => {
    clinicPetAccessService.findActiveAccessForVeterinarianUser.mockResolvedValue(
      [
        {
          petId,
          clinicId: clinicA,
          status: ClinicPetAccessStatus.ACTIVE,
          grantedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          petId,
          clinicId: clinicB,
          status: ClinicPetAccessStatus.ACTIVE,
          grantedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
    );
    ownerPetsClient.fetchPetsByIds.mockResolvedValue([ownerPet]);

    const patients = await service.getMyPatients(userId);

    expect(patients).toHaveLength(1);
    expect(patients[0]?.clinicAccesses).toHaveLength(2);
  });

  it('surfaces a controlled error when the Owner backend is unavailable', async () => {
    clinicPetAccessService.findActiveAccessForVeterinarianUser.mockResolvedValue(
      [
        {
          petId,
          clinicId: clinicA,
          status: ClinicPetAccessStatus.ACTIVE,
          grantedAt: new Date(),
        },
      ],
    );
    ownerPetsClient.fetchPetsByIds.mockRejectedValue(
      new ServiceUnavailableException(
        'Unable to load patient data from the Owner system',
      ),
    );

    await expect(service.getMyPatients(userId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns a single authorized patient by id', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      {
        petId,
        clinicId: clinicA,
        status: ClinicPetAccessStatus.ACTIVE,
        grantedAt: new Date(),
      },
    ]);
    ownerPetsClient.fetchPetsByIds.mockResolvedValue([ownerPet]);

    const patient = await service.getPatientById(userId, petId);

    expect(patient.id).toBe(petId);
    expect(
      clinicPetAccessService.assertUserHasActiveAccessToPet,
    ).toHaveBeenCalledWith(userId, petId);
  });

  it('rejects viewing a patient without active access', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockRejectedValue(
      new ForbiddenException('No active access to this patient'),
    );

    await expect(service.getPatientById(userId, petId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(ownerPetsClient.fetchPetsByIds).not.toHaveBeenCalled();
  });

  it('registers a patient through Owner and grants clinic access', async () => {
    ownerPetsClient.registerPetForVet.mockResolvedValue(ownerPet);
    clinicPetAccessService.grantActiveAccess.mockResolvedValue({
      petId,
      clinicId: clinicA,
      status: ClinicPetAccessStatus.ACTIVE,
      grantedAt: new Date(),
    });

    const patient = await service.registerPatient(userId, {
      clinicId: clinicA.toString(),
      owner: {
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Owner',
      },
      name: 'Luna',
      species: 'Cat',
    });

    expect(
      clinicMembershipsService.assertActiveMembership,
    ).toHaveBeenCalledWith(vetProfileId.toString(), clinicA.toString());
    expect(ownerPetsClient.registerPetForVet).toHaveBeenCalled();
    expect(clinicPetAccessService.grantActiveAccess).toHaveBeenCalled();
    expect(patient.name).toBe('Luna');
  });

  it('updates an authorized patient through the Owner integration', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      {
        petId,
        clinicId: clinicA,
        status: ClinicPetAccessStatus.ACTIVE,
        grantedAt: new Date(),
      },
    ]);
    ownerPetsClient.updatePetForVet.mockResolvedValue({
      ...ownerPet,
      name: 'Luna Updated',
    });

    const patient = await service.updatePatient(userId, petId, {
      name: 'Luna Updated',
    });

    expect(ownerPetsClient.updatePetForVet).toHaveBeenCalledWith(petId, {
      name: 'Luna Updated',
      species: undefined,
      breed: undefined,
      gender: undefined,
      birthDate: undefined,
    });
    expect(patient.name).toBe('Luna Updated');
  });

  it('updates owner first and last name for an authorized patient', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      {
        petId,
        clinicId: clinicA,
        status: ClinicPetAccessStatus.ACTIVE,
        grantedAt: new Date(),
      },
    ]);
    ownerPetsClient.updateOwnerProfileForVet.mockResolvedValue({
      ...ownerPet,
      owner: { ...ownerPet.owner, firstName: 'Janet', lastName: 'Ownerson' },
    });
    ownerPetsClient.updatePetForVet.mockResolvedValue({
      ...ownerPet,
      name: 'Luna',
    });
    ownerPetsClient.fetchPetsByIds.mockResolvedValue([
      {
        ...ownerPet,
        owner: { ...ownerPet.owner, firstName: 'Janet', lastName: 'Ownerson' },
      },
    ]);

    const patient = await service.updatePatient(userId, petId, {
      name: 'Luna',
      owner: {
        firstName: 'Janet',
        lastName: 'Ownerson',
        email: 'jane@example.com',
      },
    });

    expect(ownerPetsClient.updateOwnerProfileForVet).toHaveBeenCalledWith(
      petId,
      {
        firstName: 'Janet',
        lastName: 'Ownerson',
        email: 'jane@example.com',
      },
    );
    expect(patient.owner.firstName).toBe('Janet');
    expect(patient.owner.lastName).toBe('Ownerson');
  });

  it('does not update owner without active clinic pet access', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockRejectedValue(
      new ForbiddenException('No active access to this patient'),
    );

    await expect(
      service.updatePatient(userId, petId, {
        owner: {
          firstName: 'Janet',
          lastName: 'Ownerson',
          email: 'jane@example.com',
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(ownerPetsClient.updateOwnerProfileForVet).not.toHaveBeenCalled();
  });

  it('surfaces Owner integration failures when owner update fails', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      {
        petId,
        clinicId: clinicA,
        status: ClinicPetAccessStatus.ACTIVE,
        grantedAt: new Date(),
      },
    ]);
    ownerPetsClient.updateOwnerProfileForVet.mockRejectedValue(
      new ServiceUnavailableException(
        'Unable to update patient owner in the Owner system',
      ),
    );

    await expect(
      service.updatePatient(userId, petId, {
        owner: {
          firstName: 'Janet',
          lastName: 'Ownerson',
          email: 'jane@example.com',
        },
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects editing a patient without active access', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockRejectedValue(
      new ForbiddenException('No active access to this patient'),
    );

    await expect(
      service.updatePatient(userId, petId, { name: 'Blocked' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ownerPetsClient.updatePetForVet).not.toHaveBeenCalled();
  });

  it('rejects registering a patient for a clinic without membership', async () => {
    clinicMembershipsService.assertActiveMembership.mockRejectedValue(
      new ForbiddenException('No active membership for this clinic'),
    );

    await expect(
      service.registerPatient(userId, {
        clinicId: clinicA.toString(),
        owner: {
          email: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Owner',
        },
        name: 'Luna',
        species: 'Cat',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ownerPetsClient.registerPetForVet).not.toHaveBeenCalled();
  });

  it('claims a patient with an owner share code and grants clinic access', async () => {
    ownerPetsClient.redeemPetShareCode.mockResolvedValue(ownerPet);
    clinicPetAccessService.grantActiveAccess.mockResolvedValue({
      petId,
      clinicId: clinicA,
      status: ClinicPetAccessStatus.ACTIVE,
      grantedAt: new Date(),
    });

    const patient = await service.claimPatientByShareCode(userId, {
      clinicId: clinicA.toString(),
      code: 'ABCD-2345',
    });

    expect(
      clinicMembershipsService.assertActiveMembership,
    ).toHaveBeenCalledWith(vetProfileId.toString(), clinicA.toString());
    expect(clinicsService.findById).toHaveBeenCalledWith(clinicA.toString());
    expect(ownerPetsClient.redeemPetShareCode).toHaveBeenCalledWith(
      'ABCD-2345',
      clinicA.toString(),
      'Paws Clinic',
    );
    expect(clinicPetAccessService.grantActiveAccess).toHaveBeenCalledWith({
      clinicId: clinicA.toString(),
      petId,
      grantedByUserId: userId,
    });
    expect(patient.id).toBe(petId);
  });

  it('does not redeem a share code for a clinic the vet is not a member of', async () => {
    clinicMembershipsService.assertActiveMembership.mockRejectedValue(
      new ForbiddenException('Not a member'),
    );

    await expect(
      service.claimPatientByShareCode(userId, {
        clinicId: clinicB.toString(),
        code: 'ABCD-2345',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ownerPetsClient.redeemPetShareCode).not.toHaveBeenCalled();
  });

  it('does not expose delete patient operations', async () => {
    expect(
      (service as { deletePatient?: unknown }).deletePatient,
    ).toBeUndefined();
  });

  it('returns not found when Owner pet is missing after access check', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      {
        petId,
        clinicId: clinicA,
        status: ClinicPetAccessStatus.ACTIVE,
        grantedAt: new Date(),
      },
    ]);
    ownerPetsClient.fetchPetsByIds.mockResolvedValue([]);

    await expect(service.getPatientById(userId, petId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reuses existing clinic access when registration conflicts', async () => {
    ownerPetsClient.registerPetForVet.mockResolvedValue(ownerPet);
    clinicPetAccessService.grantActiveAccess.mockRejectedValue(
      new ConflictException('Active clinic pet access already exists'),
    );
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      {
        petId,
        clinicId: clinicA,
        status: ClinicPetAccessStatus.ACTIVE,
        grantedAt: new Date(),
      },
    ]);

    const patient = await service.registerPatient(userId, {
      clinicId: clinicA.toString(),
      owner: {
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Owner',
      },
      name: 'Luna',
      species: 'Cat',
    });

    expect(patient.id).toBe(petId);
  });
});
