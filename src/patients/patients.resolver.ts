import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { GqlRolesGuard } from '../auth/guards/gql-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { PatientObject } from './dto/patient.object';
import { RegisterPatientInput } from './dto/register-patient.input';
import { UpdatePatientInput } from './dto/update-patient.input';
import { PatientsService } from './patients.service';

@Resolver()
export class PatientsResolver {
  constructor(private readonly patientsService: PatientsService) {}

  @Query(() => [PatientObject], { name: 'myPatients' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  myPatients(@CurrentUser() user: UserDocument): Promise<PatientObject[]> {
    return this.patientsService.getMyPatients(user._id.toString());
  }

  @Query(() => PatientObject, { name: 'patient' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  patient(
    @CurrentUser() user: UserDocument,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PatientObject> {
    return this.patientsService.getPatientById(user._id.toString(), id);
  }

  @Mutation(() => PatientObject, { name: 'registerPatient' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  registerPatient(
    @CurrentUser() user: UserDocument,
    @Args('input') input: RegisterPatientInput,
  ): Promise<PatientObject> {
    return this.patientsService.registerPatient(user._id.toString(), input);
  }

  @Mutation(() => PatientObject, { name: 'updatePatient' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  updatePatient(
    @CurrentUser() user: UserDocument,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePatientInput,
  ): Promise<PatientObject> {
    return this.patientsService.updatePatient(
      user._id.toString(),
      id,
      input,
    );
  }
}
