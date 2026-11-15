import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClinicPetAccessService } from '../clinic-pet-access/clinic-pet-access.service';
import { ClinicMembershipsService } from '../clinics/clinic-memberships.service';
import { ClinicsService } from '../clinics/clinics.service';
import {
  OwnerCanonicalMedicalRecord,
  OwnerMedicalRecordsClient,
  OwnerMedicalRecordsPageQuery,
} from '../owner-integration/owner-medical-records.client';
import { OwnerPetsClient } from '../owner-integration/owner-pets.client';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { VetAppointmentObject } from '../appointments/dto/appointment.object';
import { CreateVetMedicalRecordInput } from './dto/create-vet-medical-record.input';
import { VetMedicalRecordObject } from './dto/medical-record.object';
import { PatientMedicalRecordsPageObject } from './dto/patient-medical-records-page.object';
import { UpdateVetMedicalRecordInput } from './dto/update-vet-medical-record.input';

@Injectable()
export class MedicalRecordsService {
  constructor(
    private readonly clinicPetAccessService: ClinicPetAccessService,
    private readonly clinicMembershipsService: ClinicMembershipsService,
    private readonly clinicsService: ClinicsService,
    private readonly ownerMedicalRecordsClient: OwnerMedicalRecordsClient,
    private readonly ownerPetsClient: OwnerPetsClient,
    private readonly veterinariansService: VeterinariansService,
  ) {}

  async getMedicalRecordsPageForPatient(
    userId: string,
    patientId: string,
    query: OwnerMedicalRecordsPageQuery,
  ): Promise<PatientMedicalRecordsPageObject> {
    await this.clinicPetAccessService.assertUserHasActiveAccessToPet(
      userId,
      patientId,
    );

    const patient = await this.loadPatientSummary(patientId);
    const ownerPage = await this.ownerMedicalRecordsClient.fetchMedicalRecordsPage(
      patientId,
      query,
    );

    return {
      items: ownerPage.items.map((record) => this.mapRecord(record, patient)),
      total: ownerPage.total,
      page: ownerPage.page,
      limit: ownerPage.limit,
      totalPages: ownerPage.totalPages,
    };
  }

  async getMedicalRecordById(
    userId: string,
    medicalRecordId: string,
  ): Promise<VetMedicalRecordObject> {
    const ownerRecord =
      await this.ownerMedicalRecordsClient.fetchMedicalRecordById(
        medicalRecordId,
      );
    await this.clinicPetAccessService.assertUserHasActiveAccessToPet(
      userId,
      ownerRecord.petId,
    );

    const patient = await this.loadPatientSummary(ownerRecord.petId);
    return this.mapRecord(ownerRecord, patient);
  }

  async createMedicalRecord(
    userId: string,
    input: CreateVetMedicalRecordInput,
  ): Promise<VetMedicalRecordObject> {
    await this.assertAccessAtClinic(userId, input.clinicId, input.petId);

    const clinic = await this.clinicsService.findById(input.clinicId);
    const profile = await this.veterinariansService.findByUserId(userId);
    const veterinarianName = `${profile.firstName} ${profile.lastName}`.trim();

    const created = await this.ownerMedicalRecordsClient.createMedicalRecord({
      petId: input.petId,
      date: input.date.toISOString(),
      type: input.type,
      title: input.title,
      description: input.description,
      diagnosis: input.diagnosis,
      clinicName: clinic.name,
      veterinarianName,
      notes: input.notes,
    });

    const patient = await this.loadPatientSummary(input.petId);
    return this.mapRecord(created, patient);
  }

  async updateMedicalRecord(
    userId: string,
    medicalRecordId: string,
    input: UpdateVetMedicalRecordInput,
  ): Promise<VetMedicalRecordObject> {
    const existing =
      await this.ownerMedicalRecordsClient.fetchMedicalRecordById(
        medicalRecordId,
      );
    await this.clinicPetAccessService.assertUserHasActiveAccessToPet(
      userId,
      existing.petId,
    );

    const updated = await this.ownerMedicalRecordsClient.updateMedicalRecord(
      medicalRecordId,
      {
        date: input.date?.toISOString(),
        type: input.type,
        title: input.title,
        description: input.description,
        diagnosis: input.diagnosis,
        notes: input.notes,
      },
    );

    const patient = await this.loadPatientSummary(updated.petId);
    return this.mapRecord(updated, patient);
  }

  private async assertAccessAtClinic(
    userId: string,
    clinicId: string,
    petId: string,
  ): Promise<void> {
    const profile = await this.veterinariansService.findByUserId(userId);
    await this.clinicMembershipsService.assertActiveMembership(
      profile._id.toString(),
      clinicId,
    );
    const access =
      await this.clinicPetAccessService.findActiveAccessForClinicAndPet(
        clinicId,
        petId,
      );
    if (!access) {
      throw new ForbiddenException('No active access to this patient at the clinic');
    }
  }

  private async loadPatientSummary(
    petId: string,
  ): Promise<VetAppointmentObject['patient']> {
    const pets = await this.ownerPetsClient.fetchPetsByIds([petId]);
    const pet = pets[0];
    if (!pet) {
      throw new NotFoundException('Patient not found');
    }
    return {
      id: pet.id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      ownerFirstName: pet.owner.firstName,
      ownerLastName: pet.owner.lastName,
      ownerEmail: pet.owner.email,
    };
  }

  private mapRecord(
    record: OwnerCanonicalMedicalRecord,
    patient: VetAppointmentObject['patient'],
  ): VetMedicalRecordObject {
    return {
      id: record.id,
      petId: record.petId,
      date: new Date(record.date),
      type: record.type,
      title: record.title,
      description: record.description,
      diagnosis: record.diagnosis,
      veterinarianName: record.veterinarianName,
      clinicName: record.clinicName,
      notes: record.notes,
      patient,
    };
  }
}
