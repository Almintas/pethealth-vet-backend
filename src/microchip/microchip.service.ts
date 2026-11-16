import { Injectable } from '@nestjs/common';
import { ClinicPetAccessService } from '../clinic-pet-access/clinic-pet-access.service';
import { ClinicMembershipsService } from '../clinics/clinic-memberships.service';
import { ClinicsService } from '../clinics/clinics.service';
import { OwnerMicrochipClient } from '../owner-integration/owner-microchip.client';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import {
  MicrochipSearchInput,
  NotifyOwnerAboutFoundPetInput,
} from './dto/microchip.input';
import { MicrochipSearchResultObject } from './dto/microchip-search.object';

export function normalizeMicrochipInput(value: string): string {
  return value.replace(/[\s.\-_/]+/g, '').toUpperCase();
}

/**
 * Finds a pet by microchip for a clinic. Without the owner's consent the
 * clinic learns only the pet's name and species and can ask PetHealth to
 * email the owner; it never gets the owner's details or records.
 */
@Injectable()
export class MicrochipService {
  constructor(
    private readonly veterinariansService: VeterinariansService,
    private readonly clinicMembershipsService: ClinicMembershipsService,
    private readonly clinicPetAccessService: ClinicPetAccessService,
    private readonly clinicsService: ClinicsService,
    private readonly ownerMicrochipClient: OwnerMicrochipClient,
  ) {}

  private async assertMember(userId: string, clinicId: string): Promise<void> {
    const profile = await this.veterinariansService.findByUserId(userId);
    await this.clinicMembershipsService.assertActiveMembership(
      profile._id.toString(),
      clinicId,
    );
  }

  async search(
    userId: string,
    input: MicrochipSearchInput,
  ): Promise<MicrochipSearchResultObject> {
    await this.assertMember(userId, input.clinicId);
    const matches = await this.ownerMicrochipClient.findByMicrochip(
      input.microchip,
    );
    return {
      microchip: normalizeMicrochipInput(input.microchip),
      matches: await Promise.all(
        matches.map(async (match) => ({
          ...match,
          hasAccess: Boolean(
            await this.clinicPetAccessService.findActiveAccessForClinicAndPet(
              input.clinicId,
              match.petId,
            ),
          ),
        })),
      ),
    };
  }

  /** Returns whether an email went out to the owner. */
  async notifyOwner(
    userId: string,
    input: NotifyOwnerAboutFoundPetInput,
  ): Promise<boolean> {
    await this.assertMember(userId, input.clinicId);
    const clinic = await this.clinicsService.findById(input.clinicId);
    return this.ownerMicrochipClient.notifyOwner({
      microchip: input.microchip,
      petId: input.petId,
      clinicName: clinic.name,
      clinicPhone: clinic.phone || undefined,
      clinicAddress: clinic.address || undefined,
      message: input.message || undefined,
    });
  }
}
