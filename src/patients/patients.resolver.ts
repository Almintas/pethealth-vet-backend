import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RATE_LIMITS } from '../common/rate-limit/rate-limit.rules';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditEntityType } from '../audit/enums/audit.enums';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { GqlRolesGuard } from '../auth/guards/gql-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { ClaimPatientByShareCodeInput } from './dto/claim-patient-by-share-code.input';
import { PatientObject } from './dto/patient.object';
import { RegisterPatientInput } from './dto/register-patient.input';
import { UpdatePatientInput } from './dto/update-patient.input';
import { PatientsService } from './patients.service';

@Resolver()
export class PatientsResolver {
  constructor(
    private readonly patientsService: PatientsService,
    private readonly auditService: AuditService,
  ) {}

  @Query(() => [PatientObject], { name: 'myPatients' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(UserRole.VETERINARIAN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST)
  myPatients(@CurrentUser() user: UserDocument): Promise<PatientObject[]> {
    return this.patientsService.getMyPatients(user._id.toString());
  }

  @Query(() => PatientObject, { name: 'patient' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(UserRole.VETERINARIAN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST)
  async patient(
    @CurrentUser() user: UserDocument,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PatientObject> {
    const patient = await this.patientsService.getPatientById(
      user._id.toString(),
      id,
    );
    await this.auditService.recordClinicActivity({
      actorUserId: user._id.toString(),
      petId: patient.id,
      action: AuditAction.VIEWED,
      entityType: AuditEntityType.PATIENT,
      entityId: patient.id,
    });
    return patient;
  }

  @Mutation(() => PatientObject, { name: 'registerPatient' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(UserRole.VETERINARIAN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST)
  async registerPatient(
    @CurrentUser() user: UserDocument,
    @Args('input') input: RegisterPatientInput,
  ): Promise<PatientObject> {
    const patient = await this.patientsService.registerPatient(
      user._id.toString(),
      input,
    );
    await this.auditService.recordClinicActivity({
      actorUserId: user._id.toString(),
      petId: patient.id,
      clinicId: input.clinicId,
      action: AuditAction.CREATED,
      entityType: AuditEntityType.PATIENT,
      entityId: patient.id,
      summary: patient.name,
    });
    return patient;
  }

  @Mutation(() => PatientObject, {
    name: 'claimPatientByShareCode',
    description:
      "Adds an owner's existing pet to the clinic using the owner's one-time share code",
  })
  @RateLimit(RATE_LIMITS.claimByCode)
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(UserRole.VETERINARIAN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST)
  async claimPatientByShareCode(
    @CurrentUser() user: UserDocument,
    @Args('input') input: ClaimPatientByShareCodeInput,
  ): Promise<PatientObject> {
    const patient = await this.patientsService.claimPatientByShareCode(
      user._id.toString(),
      input,
    );
    await this.auditService.recordClinicActivity({
      actorUserId: user._id.toString(),
      petId: patient.id,
      clinicId: input.clinicId,
      action: AuditAction.ACCESS_GRANTED,
      entityType: AuditEntityType.PATIENT,
      entityId: patient.id,
      summary: patient.name,
    });
    return patient;
  }

  @Mutation(() => PatientObject, { name: 'updatePatient' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(UserRole.VETERINARIAN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST)
  async updatePatient(
    @CurrentUser() user: UserDocument,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePatientInput,
  ): Promise<PatientObject> {
    const patient = await this.patientsService.updatePatient(
      user._id.toString(),
      id,
      input,
    );
    await this.auditService.recordClinicActivity({
      actorUserId: user._id.toString(),
      petId: patient.id,
      action: AuditAction.UPDATED,
      entityType: AuditEntityType.PATIENT,
      entityId: patient.id,
      summary: patient.name,
    });
    return patient;
  }
}
