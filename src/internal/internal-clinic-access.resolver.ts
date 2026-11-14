import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClinicPetAccessService } from '../clinic-pet-access/clinic-pet-access.service';
import { InternalClinicAccessObject } from './dto/internal-clinic-access.object';
import { InternalServiceGuard } from './guards/internal-service.guard';

/** Service-to-service operations used by the Owner backend. */
@Resolver()
export class InternalClinicAccessResolver {
  constructor(
    private readonly clinicPetAccessService: ClinicPetAccessService,
  ) {}

  @Query(() => [InternalClinicAccessObject], {
    name: 'internalClinicAccessForPet',
    description: 'Clinics that currently have active access to a pet',
  })
  @UseGuards(InternalServiceGuard)
  async internalClinicAccessForPet(
    @Args('petId', { type: () => ID }) petId: string,
  ): Promise<InternalClinicAccessObject[]> {
    const records =
      await this.clinicPetAccessService.listActiveAccessForPet(petId);
    return records.map(({ access, clinic }) => ({
      clinicId: access.clinicId.toString(),
      clinicName: clinic?.name ?? 'Unknown clinic',
      clinicPhone: clinic?.phone,
      clinicAddress: clinic?.address,
      grantedAt: access.grantedAt,
    }));
  }

  @Mutation(() => Boolean, {
    name: 'internalRevokeClinicPetAccess',
    description: "Owner-initiated revocation of a clinic's access to a pet",
  })
  @UseGuards(InternalServiceGuard)
  internalRevokeClinicPetAccess(
    @Args('petId', { type: () => ID }) petId: string,
    @Args('clinicId', { type: () => ID }) clinicId: string,
  ): Promise<boolean> {
    return this.clinicPetAccessService.revokeAccessForPetByOwner(
      petId,
      clinicId,
    );
  }
}
