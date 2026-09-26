import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClinicPetAccessService } from '../clinic-pet-access/clinic-pet-access.service';
import { ClinicMembershipsService } from '../clinics/clinic-memberships.service';
import { ClinicsService } from '../clinics/clinics.service';
import {
  OwnerCanonicalVaccination,
  OwnerVaccinationsClient,
  OwnerVaccinationsPageQuery,
} from '../owner-integration/owner-vaccinations.client';
import { OwnerPetsClient } from '../owner-integration/owner-pets.client';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { VetAppointmentObject } from '../appointments/dto/appointment.object';
import { CreateVetVaccinationInput } from './dto/create-vet-vaccination.input';
import { PatientVaccinationsPageObject } from './dto/patient-vaccinations-page.object';
import { UpdateVetVaccinationInput } from './dto/update-vet-vaccination.input';
import { VetVaccinationObject } from './dto/vaccination.object';

@Injectable()
export class VaccinationsService {
  constructor(
    private readonly clinicPetAccessService: ClinicPetAccessService,
    private readonly clinicMembershipsService: ClinicMembershipsService,
    private readonly clinicsService: ClinicsService,
    private readonly ownerVaccinationsClient: OwnerVaccinationsClient,
    private readonly ownerPetsClient: OwnerPetsClient,
    private readonly veterinariansService: VeterinariansService,
  ) {}

  async getVaccinationsPageForPatient(
    userId: string,
    patientId: string,
    query: OwnerVaccinationsPageQuery,
  ): Promise<PatientVaccinationsPageObject> {
    await this.clinicPetAccessService.assertUserHasActiveAccessToPet(
      userId,
      patientId,
    );

    const patient = await this.loadPatientSummary(patientId);
    const ownerPage = await this.ownerVaccinationsClient.fetchVaccinationsPage(
      patientId,
      query,
    );

    return {
      items: ownerPage.items.map((record) => this.mapVaccination(record, patient)),
      total: ownerPage.total,
      page: ownerPage.page,
      limit: ownerPage.limit,
      totalPages: ownerPage.totalPages,
      nextDueVaccineName: ownerPage.nextDueVaccineName,
      nextDueAt: ownerPage.nextDueAt
        ? new Date(ownerPage.nextDueAt)
        : undefined,
    };
  }

  async getVaccinationById(
    userId: string,
    vaccinationId: string,
  ): Promise<VetVaccinationObject> {
    const ownerRecord =
      await this.ownerVaccinationsClient.fetchVaccinationById(vaccinationId);
    await this.clinicPetAccessService.assertUserHasActiveAccessToPet(
      userId,
      ownerRecord.petId,
    );

    const patient = await this.loadPatientSummary(ownerRecord.petId);
    return this.mapVaccination(ownerRecord, patient);
  }

  async createVaccination(
    userId: string,
    input: CreateVetVaccinationInput,
  ): Promise<VetVaccinationObject> {
    await this.assertAccessAtClinic(userId, input.clinicId, input.petId);

    const clinic = await this.clinicsService.findById(input.clinicId);
    const profile = await this.veterinariansService.findByUserId(userId);
    const veterinarianName = `${profile.firstName} ${profile.lastName}`.trim();

    const created = await this.ownerVaccinationsClient.createVaccination({
      petId: input.petId,
      vaccineName: input.vaccineName,
      administeredAt: input.administeredAt.toISOString(),
      nextDueAt: input.nextDueAt?.toISOString(),
      clinicName: clinic.name,
      veterinarianName,
      batchNumber: input.batchNumber,
      notes: input.notes,
    });

    const patient = await this.loadPatientSummary(input.petId);
    return this.mapVaccination(created, patient);
  }

  async updateVaccination(
    userId: string,
    vaccinationId: string,
    input: UpdateVetVaccinationInput,
  ): Promise<VetVaccinationObject> {
    const existing =
      await this.ownerVaccinationsClient.fetchVaccinationById(vaccinationId);
    await this.clinicPetAccessService.assertUserHasActiveAccessToPet(
      userId,
      existing.petId,
    );

    const updated = await this.ownerVaccinationsClient.updateVaccination(
      vaccinationId,
      {
        vaccineName: input.vaccineName,
        administeredAt: input.administeredAt?.toISOString(),
        nextDueAt: input.nextDueAt?.toISOString(),
        batchNumber: input.batchNumber,
        notes: input.notes,
      },
    );

    const patient = await this.loadPatientSummary(updated.petId);
    return this.mapVaccination(updated, patient);
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

  private mapVaccination(
    record: OwnerCanonicalVaccination,
    patient: VetAppointmentObject['patient'],
  ): VetVaccinationObject {
    return {
      id: record.id,
      petId: record.petId,
      vaccineName: record.vaccineName,
      administeredAt: new Date(record.administeredAt),
      nextDueAt: record.nextDueAt ? new Date(record.nextDueAt) : undefined,
      veterinarianName: record.veterinarianName,
      clinicName: record.clinicName,
      batchNumber: record.batchNumber,
      notes: record.notes,
      patient,
    };
  }
}
