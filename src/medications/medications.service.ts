import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClinicPetAccessService } from '../clinic-pet-access/clinic-pet-access.service';
import { ClinicMembershipsService } from '../clinics/clinic-memberships.service';
import { ClinicsService } from '../clinics/clinics.service';
import {
  OwnerCanonicalMedication,
  OwnerMedicationsClient,
  OwnerMedicationsPageQuery,
} from '../owner-integration/owner-medications.client';
import { OwnerPetsClient } from '../owner-integration/owner-pets.client';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { VetAppointmentObject } from '../appointments/dto/appointment.object';
import { CreateVetMedicationInput } from './dto/create-vet-medication.input';
import { VetMedicationObject } from './dto/medication.object';
import { PatientMedicationsPageObject } from './dto/patient-medications-page.object';
import { UpdateVetMedicationInput } from './dto/update-vet-medication.input';

@Injectable()
export class MedicationsService {
  constructor(
    private readonly clinicPetAccessService: ClinicPetAccessService,
    private readonly clinicMembershipsService: ClinicMembershipsService,
    private readonly clinicsService: ClinicsService,
    private readonly ownerMedicationsClient: OwnerMedicationsClient,
    private readonly ownerPetsClient: OwnerPetsClient,
    private readonly veterinariansService: VeterinariansService,
  ) {}

  async getMedicationsPageForPatient(
    userId: string,
    patientId: string,
    query: OwnerMedicationsPageQuery,
  ): Promise<PatientMedicationsPageObject> {
    await this.clinicPetAccessService.assertUserHasActiveAccessToPet(
      userId,
      patientId,
    );

    const patient = await this.loadPatientSummary(patientId);
    const ownerPage = await this.ownerMedicationsClient.fetchMedicationsPage(
      patientId,
      query,
    );

    return {
      items: ownerPage.items.map((medication) =>
        this.mapMedication(medication, patient),
      ),
      total: ownerPage.total,
      page: ownerPage.page,
      limit: ownerPage.limit,
      totalPages: ownerPage.totalPages,
      activeTotal: ownerPage.activeTotal,
    };
  }

  async getMedicationById(
    userId: string,
    medicationId: string,
  ): Promise<VetMedicationObject> {
    const ownerMedication =
      await this.ownerMedicationsClient.fetchMedicationById(medicationId);
    await this.clinicPetAccessService.assertUserHasActiveAccessToPet(
      userId,
      ownerMedication.petId,
    );

    const patient = await this.loadPatientSummary(ownerMedication.petId);
    return this.mapMedication(ownerMedication, patient);
  }

  async createMedication(
    userId: string,
    input: CreateVetMedicationInput,
  ): Promise<VetMedicationObject> {
    await this.assertAccessAtClinic(userId, input.clinicId, input.petId);

    const clinic = await this.clinicsService.findById(input.clinicId);
    const profile = await this.veterinariansService.findByUserId(userId);
    const veterinarianName = `${profile.firstName} ${profile.lastName}`.trim();

    const created = await this.ownerMedicationsClient.createMedication({
      petId: input.petId,
      name: input.name,
      dosage: input.dosage,
      dosageUnit: input.dosageUnit,
      frequency: input.frequency,
      startDate: input.startDate.toISOString(),
      endDate: input.endDate?.toISOString(),
      clinicName: clinic.name,
      veterinarianName,
      notes: input.notes,
      isActive: true,
    });

    const patient = await this.loadPatientSummary(input.petId);
    return this.mapMedication(created, patient);
  }

  async updateMedication(
    userId: string,
    medicationId: string,
    input: UpdateVetMedicationInput,
  ): Promise<VetMedicationObject> {
    const existing =
      await this.ownerMedicationsClient.fetchMedicationById(medicationId);
    await this.clinicPetAccessService.assertUserHasActiveAccessToPet(
      userId,
      existing.petId,
    );

    const updated = await this.ownerMedicationsClient.updateMedication(
      medicationId,
      {
        name: input.name,
        dosage: input.dosage,
        dosageUnit: input.dosageUnit,
        frequency: input.frequency,
        startDate: input.startDate?.toISOString(),
        endDate: input.endDate?.toISOString(),
        notes: input.notes,
        isActive: input.isActive,
      },
    );

    const patient = await this.loadPatientSummary(updated.petId);
    return this.mapMedication(updated, patient);
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

  private mapMedication(
    medication: OwnerCanonicalMedication,
    patient: VetAppointmentObject['patient'],
  ): VetMedicationObject {
    return {
      id: medication.id,
      petId: medication.petId,
      name: medication.name,
      dosage: medication.dosage,
      dosageUnit: medication.dosageUnit,
      frequency: medication.frequency,
      startDate: new Date(medication.startDate),
      endDate: medication.endDate ? new Date(medication.endDate) : undefined,
      veterinarianName: medication.veterinarianName,
      clinicName: medication.clinicName,
      notes: medication.notes,
      isActive: medication.isActive,
      patient,
    };
  }
}
