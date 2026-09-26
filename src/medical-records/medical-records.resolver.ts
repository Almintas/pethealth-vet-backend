import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { GqlRolesGuard } from '../auth/guards/gql-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { CreateVetMedicalRecordInput } from './dto/create-vet-medical-record.input';
import { VetMedicalRecordObject } from './dto/medical-record.object';
import { PatientMedicalRecordsPageInput } from './dto/patient-medical-records-page.input';
import { PatientMedicalRecordsPageObject } from './dto/patient-medical-records-page.object';
import { UpdateVetMedicalRecordInput } from './dto/update-vet-medical-record.input';
import { MedicalRecordsService } from './medical-records.service';

@Resolver()
export class MedicalRecordsResolver {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @Query(() => PatientMedicalRecordsPageObject, {
    name: 'patientMedicalRecordsPage',
  })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  patientMedicalRecordsPage(
    @CurrentUser() user: UserDocument,
    @Args('patientId', { type: () => ID }) patientId: string,
    @Args('query', { nullable: true }) query?: PatientMedicalRecordsPageInput,
  ): Promise<PatientMedicalRecordsPageObject> {
    const input = query ?? {};
    return this.medicalRecordsService.getMedicalRecordsPageForPatient(
      user._id.toString(),
      patientId,
      {
        page: input.page,
        limit: input.limit,
        search: input.search,
        type: input.type,
        dateFrom: input.dateFrom?.toISOString(),
        dateTo: input.dateTo?.toISOString(),
      },
    );
  }

  @Query(() => VetMedicalRecordObject, { name: 'vetMedicalRecord' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  vetMedicalRecord(
    @CurrentUser() user: UserDocument,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<VetMedicalRecordObject> {
    return this.medicalRecordsService.getMedicalRecordById(
      user._id.toString(),
      id,
    );
  }

  @Mutation(() => VetMedicalRecordObject, { name: 'createVetMedicalRecord' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  createVetMedicalRecord(
    @CurrentUser() user: UserDocument,
    @Args('input') input: CreateVetMedicalRecordInput,
  ): Promise<VetMedicalRecordObject> {
    return this.medicalRecordsService.createMedicalRecord(
      user._id.toString(),
      input,
    );
  }

  @Mutation(() => VetMedicalRecordObject, { name: 'updateVetMedicalRecord' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  updateVetMedicalRecord(
    @CurrentUser() user: UserDocument,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateVetMedicalRecordInput,
  ): Promise<VetMedicalRecordObject> {
    return this.medicalRecordsService.updateMedicalRecord(
      user._id.toString(),
      id,
      input,
    );
  }
}
