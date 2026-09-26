import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { GqlRolesGuard } from '../auth/guards/gql-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { CreateVetMedicationInput } from './dto/create-vet-medication.input';
import { VetMedicationObject } from './dto/medication.object';
import { PatientMedicationsPageInput } from './dto/patient-medications-page.input';
import { PatientMedicationsPageObject } from './dto/patient-medications-page.object';
import { UpdateVetMedicationInput } from './dto/update-vet-medication.input';
import { MedicationsService } from './medications.service';

@Resolver()
export class MedicationsResolver {
  constructor(private readonly medicationsService: MedicationsService) {}

  @Query(() => PatientMedicationsPageObject, {
    name: 'patientMedicationsPage',
  })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  patientMedicationsPage(
    @CurrentUser() user: UserDocument,
    @Args('patientId', { type: () => ID }) patientId: string,
    @Args('query', { nullable: true }) query?: PatientMedicationsPageInput,
  ): Promise<PatientMedicationsPageObject> {
    const input = query ?? {};
    return this.medicationsService.getMedicationsPageForPatient(
      user._id.toString(),
      patientId,
      {
        page: input.page,
        limit: input.limit,
        search: input.search,
        isActive: input.isActive,
      },
    );
  }

  @Query(() => VetMedicationObject, { name: 'vetMedication' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  vetMedication(
    @CurrentUser() user: UserDocument,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<VetMedicationObject> {
    return this.medicationsService.getMedicationById(user._id.toString(), id);
  }

  @Mutation(() => VetMedicationObject, { name: 'createVetMedication' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  createVetMedication(
    @CurrentUser() user: UserDocument,
    @Args('input') input: CreateVetMedicationInput,
  ): Promise<VetMedicationObject> {
    return this.medicationsService.createMedication(
      user._id.toString(),
      input,
    );
  }

  @Mutation(() => VetMedicationObject, { name: 'updateVetMedication' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  updateVetMedication(
    @CurrentUser() user: UserDocument,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateVetMedicationInput,
  ): Promise<VetMedicationObject> {
    return this.medicationsService.updateMedication(
      user._id.toString(),
      id,
      input,
    );
  }
}
