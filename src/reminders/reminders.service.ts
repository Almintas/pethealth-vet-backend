import { ForbiddenException, Injectable } from '@nestjs/common';
import { ClinicPetAccessService } from '../clinic-pet-access/clinic-pet-access.service';
import { ClinicMembershipsService } from '../clinics/clinic-memberships.service';
import { ClinicsService } from '../clinics/clinics.service';
import {
  OwnerReminder,
  OwnerRemindersClient,
} from '../owner-integration/owner-reminders.client';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { CreateVetReminderInput } from './dto/create-vet-reminder.input';
import { VetReminderObject } from './dto/vet-reminder.object';

/**
 * Reminders a clinic sets for the pet owner (follow-up visit, repeat
 * medication…). They are stored with the owner's data; the clinic sees the
 * clinic and automatic reminders of its patients, never the owner's own.
 */
@Injectable()
export class RemindersService {
  constructor(
    private readonly clinicPetAccessService: ClinicPetAccessService,
    private readonly clinicMembershipsService: ClinicMembershipsService,
    private readonly clinicsService: ClinicsService,
    private readonly veterinariansService: VeterinariansService,
    private readonly ownerRemindersClient: OwnerRemindersClient,
  ) {}

  async listForPatient(
    userId: string,
    patientId: string,
  ): Promise<VetReminderObject[]> {
    await this.clinicPetAccessService.assertUserHasActiveAccessToPet(
      userId,
      patientId,
    );
    const reminders = await this.ownerRemindersClient.listForPet(patientId);
    return reminders.map((reminder) => this.toObject(reminder));
  }

  async create(
    userId: string,
    input: CreateVetReminderInput,
  ): Promise<VetReminderObject> {
    const profile = await this.assertAccessAtClinic(
      userId,
      input.clinicId,
      input.petId,
    );
    const clinic = await this.clinicsService.findById(input.clinicId);
    const created = await this.ownerRemindersClient.create({
      petId: input.petId,
      type: input.type,
      title: input.title,
      message: input.message || undefined,
      dueAt: input.dueAt.toISOString(),
      clinicId: input.clinicId,
      clinicName: clinic.name,
      createdByName: `${profile.firstName} ${profile.lastName}`.trim(),
    });
    return this.toObject(created);
  }

  async delete(
    userId: string,
    reminderId: string,
    clinicId: string,
    patientId: string,
  ): Promise<VetReminderObject> {
    await this.assertAccessAtClinic(userId, clinicId, patientId);
    const removed = await this.ownerRemindersClient.delete(
      reminderId,
      clinicId,
      patientId,
    );
    return this.toObject(removed);
  }

  private async assertAccessAtClinic(
    userId: string,
    clinicId: string,
    petId: string,
  ) {
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
      throw new ForbiddenException(
        'No active access to this patient at the clinic',
      );
    }
    return profile;
  }

  private toObject(reminder: OwnerReminder): VetReminderObject {
    return {
      ...reminder,
      dueAt: new Date(reminder.dueAt),
      createdAt: new Date(reminder.createdAt),
    };
  }
}
