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
import { CreateVetVaccinationInput } from './dto/create-vet-vaccination.input';
import { PatientVaccinationsPageInput } from './dto/patient-vaccinations-page.input';
import { PatientVaccinationsPageObject } from './dto/patient-vaccinations-page.object';
import { UpdateVetVaccinationInput } from './dto/update-vet-vaccination.input';
import { VetVaccinationObject } from './dto/vaccination.object';
import { VaccinationsService } from './vaccinations.service';

@Resolver()
export class VaccinationsResolver {
  constructor(
    private readonly vaccinationsService: VaccinationsService,
    private readonly auditService: AuditService,
  ) {}

  @Query(() => PatientVaccinationsPageObject, {
    name: 'patientVaccinationsPage',
  })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(UserRole.VETERINARIAN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST)
  patientVaccinationsPage(
    @CurrentUser() user: UserDocument,
    @Args('patientId', { type: () => ID }) patientId: string,
    @Args('query', { nullable: true }) query?: PatientVaccinationsPageInput,
  ): Promise<PatientVaccinationsPageObject> {
    const input = query ?? {};
    return this.vaccinationsService.getVaccinationsPageForPatient(
      user._id.toString(),
      patientId,
      {
        page: input.page,
        limit: input.limit,
        search: input.search,
        vaccineName: input.vaccineName,
        administeredFrom: input.administeredFrom?.toISOString(),
        administeredTo: input.administeredTo?.toISOString(),
        upcomingOnly: input.upcomingOnly,
      },
    );
  }

  @Query(() => VetVaccinationObject, { name: 'vetVaccination' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(UserRole.VETERINARIAN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST)
  vetVaccination(
    @CurrentUser() user: UserDocument,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<VetVaccinationObject> {
    return this.vaccinationsService.getVaccinationById(user._id.toString(), id);
  }

  @Mutation(() => VetVaccinationObject, { name: 'createVetVaccination' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(UserRole.VETERINARIAN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST)
  async createVetVaccination(
    @CurrentUser() user: UserDocument,
    @Args('input') input: CreateVetVaccinationInput,
  ): Promise<VetVaccinationObject> {
    const vaccination = await this.vaccinationsService.createVaccination(
      user._id.toString(),
      input,
    );
    await this.auditService.recordClinicActivity({
      actorUserId: user._id.toString(),
      petId: vaccination.petId,
      clinicId: input.clinicId,
      action: AuditAction.CREATED,
      entityType: AuditEntityType.VACCINATION,
      entityId: vaccination.id,
      summary: vaccination.vaccineName,
    });
    return vaccination;
  }

  @Mutation(() => VetVaccinationObject, { name: 'updateVetVaccination' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(UserRole.VETERINARIAN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST)
  async updateVetVaccination(
    @CurrentUser() user: UserDocument,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateVetVaccinationInput,
  ): Promise<VetVaccinationObject> {
    const vaccination = await this.vaccinationsService.updateVaccination(
      user._id.toString(),
      id,
      input,
    );
    await this.auditService.recordClinicActivity({
      actorUserId: user._id.toString(),
      petId: vaccination.petId,
      action: AuditAction.UPDATED,
      entityType: AuditEntityType.VACCINATION,
      entityId: vaccination.id,
      summary: vaccination.vaccineName,
    });
    return vaccination;
  }
}
