import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ClinicPetAccessService } from '../clinic-pet-access/clinic-pet-access.service';
import { ClinicMembershipsService } from '../clinics/clinic-memberships.service';
import { ClinicsService } from '../clinics/clinics.service';
import { OwnerMicrochipClient } from '../owner-integration/owner-microchip.client';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { MicrochipService, normalizeMicrochipInput } from './microchip.service';

describe('MicrochipService (clinic)', () => {
  const userId = new Types.ObjectId().toString();
  const clinicId = new Types.ObjectId().toString();
  const petA = new Types.ObjectId().toString();
  const petB = new Types.ObjectId().toString();

  const veterinariansService = {
    findByUserId: jest.fn<() => Promise<unknown>>(),
  };
  const clinicMembershipsService = {
    assertActiveMembership: jest.fn<() => Promise<unknown>>(),
  };
  const clinicPetAccessService = {
    findActiveAccessForClinicAndPet:
      jest.fn<(clinic: string, pet: string) => Promise<unknown>>(),
  };
  const clinicsService = { findById: jest.fn<() => Promise<unknown>>() };
  const ownerMicrochipClient = {
    findByMicrochip: jest.fn<() => Promise<unknown>>(),
    notifyOwner: jest.fn<(notice: unknown) => Promise<boolean>>(),
  };
  let service: MicrochipService;

  beforeEach(() => {
    jest.clearAllMocks();
    veterinariansService.findByUserId.mockResolvedValue({
      _id: new Types.ObjectId(),
    });
    clinicMembershipsService.assertActiveMembership.mockResolvedValue(
      undefined,
    );
    service = new MicrochipService(
      veterinariansService as unknown as VeterinariansService,
      clinicMembershipsService as unknown as ClinicMembershipsService,
      clinicPetAccessService as unknown as ClinicPetAccessService,
      clinicsService as unknown as ClinicsService,
      ownerMicrochipClient as unknown as OwnerMicrochipClient,
    );
  });

  it('normalizes typed chip numbers', () => {
    expect(normalizeMicrochipInput(' 440-123 456.789/012 ')).toBe(
      '440123456789012',
    );
  });

  it('tells which matches the clinic may open', async () => {
    ownerMicrochipClient.findByMicrochip.mockResolvedValue([
      { petId: petA, name: 'Rex', species: 'Dog', breed: null },
      { petId: petB, name: 'Mia', species: 'Cat', breed: null },
    ]);
    clinicPetAccessService.findActiveAccessForClinicAndPet.mockImplementation(
      (_clinic, pet) => Promise.resolve(pet === petA ? { petId: petA } : null),
    );

    const result = await service.search(userId, {
      clinicId,
      microchip: '440 123 456 789 012',
    });

    expect(result.microchip).toBe('440123456789012');
    expect(result.matches.map((match) => match.hasAccess)).toEqual([
      true,
      false,
    ]);
  });

  it('requires membership in the clinic', async () => {
    clinicMembershipsService.assertActiveMembership.mockRejectedValue(
      new ForbiddenException('Not a member'),
    );

    await expect(
      service.search(userId, { clinicId, microchip: '440123456789012' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ownerMicrochipClient.findByMicrochip).not.toHaveBeenCalled();
  });

  it('sends the clinic contacts with the owner notice', async () => {
    clinicsService.findById.mockResolvedValue({
      name: 'Paws',
      phone: '+370 600 00000',
      address: '',
    });
    ownerMicrochipClient.notifyOwner.mockResolvedValue(true);

    await expect(
      service.notifyOwner(userId, {
        clinicId,
        microchip: '440123456789012',
        petId: petB,
        message: '',
      }),
    ).resolves.toBe(true);
    expect(ownerMicrochipClient.notifyOwner).toHaveBeenCalledWith({
      microchip: '440123456789012',
      petId: petB,
      clinicName: 'Paws',
      clinicPhone: '+370 600 00000',
      clinicAddress: undefined,
      message: undefined,
    });
  });
});
