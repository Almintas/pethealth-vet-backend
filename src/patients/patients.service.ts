import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ClinicPetAccessStatus } from '../common/enums/clinic-pet-access-status.enum';
import { ClinicMembershipsService } from '../clinics/clinic-memberships.service';
import { ClinicPetAccessService } from '../clinic-pet-access/clinic-pet-access.service';
import { ClinicPetAccessDocument } from '../clinic-pet-access/schemas/clinic-pet-access.schema';
import { OwnerCanonicalPet, OwnerPetsClient } from '../owner-integration/owner-pets.client';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { PatientObject } from './dto/patient.object';
import { RegisterPatientInput } from './dto/register-patient.input';
import { UpdatePatientInput } from './dto/update-patient.input';

@Injectable()
export class PatientsService {
  constructor(
    private readonly clinicPetAccessService: ClinicPetAccessService,
    private readonly ownerPetsClient: OwnerPetsClient,
    private readonly veterinariansService: VeterinariansService,
    private readonly clinicMembershipsService: ClinicMembershipsService,
  ) {}

  async getMyPatients(userId: string): Promise<PatientObject[]> {
    const accessRecords =
      await this.clinicPetAccessService.findActiveAccessForVeterinarianUser(
        userId,
      );
    if (!accessRecords.length) {
      return [];
    }

    const accessByPetId = this.groupActiveAccessByPetId(accessRecords);
    const petIds = [...accessByPetId.keys()];
    const ownerPets = await this.ownerPetsClient.fetchPetsByIds(petIds);
    const ownerPetMap = new Map(ownerPets.map((pet) => [pet.id, pet]));

    const patients: PatientObject[] = [];
    for (const petId of petIds) {
      const ownerPet = ownerPetMap.get(petId);
      if (!ownerPet) {
        continue;
      }
      patients.push(this.mapOwnerPetToPatient(ownerPet, accessByPetId.get(petId)!));
    }

    return patients.sort((left, right) => left.name.localeCompare(right.name));
  }

  async getPatientById(userId: string, patientId: string): Promise<PatientObject> {
    const accessRecords =
      await this.clinicPetAccessService.assertUserHasActiveAccessToPet(
        userId,
        patientId,
      );
    const ownerPets = await this.ownerPetsClient.fetchPetsByIds([patientId]);
    const ownerPet = ownerPets[0];
    if (!ownerPet) {
      throw new NotFoundException('Patient not found');
    }
    return this.mapOwnerPetToPatient(ownerPet, accessRecords);
  }

  async registerPatient(
    userId: string,
    input: RegisterPatientInput,
  ): Promise<PatientObject> {
    const profile = await this.veterinariansService.findByUserId(userId);
    await this.clinicMembershipsService.assertActiveMembership(
      profile._id.toString(),
      input.clinicId,
    );

    const ownerPet = await this.ownerPetsClient.registerPetForVet({
      owner: {
        email: input.owner.email,
        firstName: input.owner.firstName,
        lastName: input.owner.lastName,
      },
      name: input.name,
      species: input.species,
      breed: input.breed,
      gender: input.gender,
      birthDate: this.toOwnerBirthDateIso(input.dateOfBirth),
    });

    let accessRecords: ClinicPetAccessDocument[];
    try {
      const access = await this.clinicPetAccessService.grantActiveAccess({
        clinicId: input.clinicId,
        petId: ownerPet.id,
        grantedByUserId: userId,
      });
      accessRecords = [access];
    } catch (error) {
      if (error instanceof ConflictException) {
        accessRecords =
          await this.clinicPetAccessService.assertUserHasActiveAccessToPet(
            userId,
            ownerPet.id,
          );
      } else {
        throw error;
      }
    }

    return this.mapOwnerPetToPatient(ownerPet, accessRecords);
  }

  async updatePatient(
    userId: string,
    patientId: string,
    input: UpdatePatientInput,
  ): Promise<PatientObject> {
    const accessRecords =
      await this.clinicPetAccessService.assertUserHasActiveAccessToPet(
        userId,
        patientId,
      );

    if (input.owner) {
      await this.ownerPetsClient.updateOwnerProfileForVet(patientId, {
        firstName: input.owner.firstName,
        lastName: input.owner.lastName,
        email: input.owner.email,
      });
    }

    const ownerPet = await this.ownerPetsClient.updatePetForVet(patientId, {
      name: input.name,
      species: input.species,
      breed: input.breed,
      gender: input.gender,
      birthDate: this.toOwnerBirthDateIso(input.dateOfBirth),
    });

    if (input.owner) {
      const refreshed = await this.ownerPetsClient.fetchPetsByIds([patientId]);
      const latest = refreshed[0];
      if (latest) {
        return this.mapOwnerPetToPatient(latest, accessRecords);
      }
    }

    return this.mapOwnerPetToPatient(ownerPet, accessRecords);
  }

  private toOwnerBirthDateIso(value?: Date | string | null): string | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    return date.toISOString();
  }

  private groupActiveAccessByPetId(
    accessRecords: ClinicPetAccessDocument[],
  ): Map<string, ClinicPetAccessDocument[]> {
    const grouped = new Map<string, ClinicPetAccessDocument[]>();
    for (const record of accessRecords) {
      const petId = record.petId.trim();
      const existing = grouped.get(petId) ?? [];
      existing.push(record);
      grouped.set(petId, existing);
    }
    return grouped;
  }

  private mapOwnerPetToPatient(
    ownerPet: OwnerCanonicalPet,
    accessRecords: ClinicPetAccessDocument[],
  ): PatientObject {
    return {
      id: ownerPet.id,
      name: ownerPet.name,
      species: ownerPet.species,
      breed: ownerPet.breed,
      gender: ownerPet.gender,
      dateOfBirth: ownerPet.birthDate ? new Date(ownerPet.birthDate) : undefined,
      owner: {
        id: ownerPet.owner.id,
        firstName: ownerPet.owner.firstName,
        lastName: ownerPet.owner.lastName,
        email: ownerPet.owner.email,
      },
      clinicAccesses: accessRecords.map((record) => ({
        clinicId: record.clinicId.toString(),
        accessStatus: ClinicPetAccessStatus.ACTIVE,
        grantedAt: record.grantedAt,
      })),
    };
  }
}
