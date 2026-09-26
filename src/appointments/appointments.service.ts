import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus } from '../common/enums/appointment-status.enum';
import { ClinicPetAccessService } from '../clinic-pet-access/clinic-pet-access.service';
import { ClinicMembershipsService } from '../clinics/clinic-memberships.service';
import { ClinicsService } from '../clinics/clinics.service';
import {
  OwnerAppointmentsClient,
  OwnerCanonicalAppointment,
} from '../owner-integration/owner-appointments.client';
import { OwnerPetsClient } from '../owner-integration/owner-pets.client';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { VetAppointmentObject } from './dto/appointment.object';
import { CreateVetAppointmentInput } from './dto/create-vet-appointment.input';
import { UpdateVetAppointmentInput } from './dto/update-vet-appointment.input';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly clinicPetAccessService: ClinicPetAccessService,
    private readonly clinicMembershipsService: ClinicMembershipsService,
    private readonly clinicsService: ClinicsService,
    private readonly ownerAppointmentsClient: OwnerAppointmentsClient,
    private readonly ownerPetsClient: OwnerPetsClient,
    private readonly veterinariansService: VeterinariansService,
  ) {}

  async getMyAppointments(userId: string): Promise<VetAppointmentObject[]> {
    const context = await this.buildAccessContext(userId);
    if (!context.petIds.length) {
      return [];
    }

    const scheduledFrom = new Date();
    scheduledFrom.setDate(scheduledFrom.getDate() - 30);
    const scheduledTo = new Date();
    scheduledTo.setFullYear(scheduledTo.getFullYear() + 1);

    const ownerAppointments =
      await this.ownerAppointmentsClient.fetchAppointmentsByPetIds(
        context.petIds,
        scheduledFrom.toISOString(),
        scheduledTo.toISOString(),
      );

    const visible = ownerAppointments.filter((appointment) =>
      this.canViewAppointment(appointment, context),
    );

    return this.mapAppointments(visible, context.patientMap);
  }

  async getAppointmentById(
    userId: string,
    appointmentId: string,
  ): Promise<VetAppointmentObject> {
    const context = await this.buildAccessContext(userId);
    const ownerAppointment =
      await this.ownerAppointmentsClient.fetchAppointmentById(appointmentId);

    if (!this.canViewAppointment(ownerAppointment, context)) {
      throw new ForbiddenException('No access to this appointment');
    }

    const mapped = await this.mapAppointments([ownerAppointment], context.patientMap);
    const appointment = mapped[0];
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }

  async createAppointment(
    userId: string,
    input: CreateVetAppointmentInput,
  ): Promise<VetAppointmentObject> {
    await this.assertAccessAtClinic(userId, input.clinicId, input.petId);

    const clinic = await this.clinicsService.findById(input.clinicId);
    const profile = await this.veterinariansService.findByUserId(userId);
    const veterinarianName = `${profile.firstName} ${profile.lastName}`.trim();

    const created = await this.ownerAppointmentsClient.createAppointment({
      petId: input.petId,
      vetClinicId: input.clinicId,
      scheduledAt: input.scheduledAt.toISOString(),
      type: input.type,
      clinicName: clinic.name,
      veterinarianName,
      reason: input.reason,
      notes: input.notes,
      status: input.status ?? AppointmentStatus.SCHEDULED,
    });

    const context = await this.buildAccessContext(userId);
    const mapped = await this.mapAppointments([created], context.patientMap);
    const appointment = mapped[0];
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }

  async updateAppointment(
    userId: string,
    appointmentId: string,
    input: UpdateVetAppointmentInput,
  ): Promise<VetAppointmentObject> {
    const existing =
      await this.ownerAppointmentsClient.fetchAppointmentById(appointmentId);
    await this.assertCanManageAppointment(userId, existing);

    const updated = await this.ownerAppointmentsClient.updateAppointment(
      appointmentId,
      {
        scheduledAt: input.scheduledAt?.toISOString(),
        type: input.type,
        reason: input.reason,
        notes: input.notes,
        status: input.status,
      },
    );

    const context = await this.buildAccessContext(userId);
    const mapped = await this.mapAppointments([updated], context.patientMap);
    const appointment = mapped[0];
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }

  async cancelAppointment(
    userId: string,
    appointmentId: string,
  ): Promise<VetAppointmentObject> {
    return this.updateAppointment(userId, appointmentId, {
      status: AppointmentStatus.CANCELLED,
    });
  }

  private async buildAccessContext(userId: string) {
    const accessRecords =
      await this.clinicPetAccessService.findActiveAccessForVeterinarianUser(
        userId,
      );
    const petIds = [...new Set(accessRecords.map((record) => record.petId.trim()))];
    const clinicIds = new Set(
      accessRecords.map((record) => record.clinicId.toString()),
    );

    const ownerPets = await this.ownerPetsClient.fetchPetsByIds(petIds);
    const patientMap = new Map(
      ownerPets.map((pet) => [
        pet.id,
        {
          id: pet.id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          ownerFirstName: pet.owner.firstName,
          ownerLastName: pet.owner.lastName,
          ownerEmail: pet.owner.email,
        },
      ]),
    );

    return { petIds, clinicIds, patientMap };
  }

  private canViewAppointment(
    appointment: OwnerCanonicalAppointment,
    context: {
      petIds: string[];
      clinicIds: Set<string>;
      patientMap: Map<string, VetAppointmentObject['patient']>;
    },
  ): boolean {
    if (!context.petIds.includes(appointment.petId)) {
      return false;
    }
    if (!appointment.vetClinicId) {
      return true;
    }
    return context.clinicIds.has(appointment.vetClinicId);
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

  private async assertCanManageAppointment(
    userId: string,
    appointment: OwnerCanonicalAppointment,
  ): Promise<void> {
    await this.clinicPetAccessService.assertUserHasActiveAccessToPet(
      userId,
      appointment.petId,
    );
    if (!appointment.vetClinicId) {
      return;
    }
    await this.assertAccessAtClinic(
      userId,
      appointment.vetClinicId,
      appointment.petId,
    );
  }

  private async mapAppointments(
    appointments: OwnerCanonicalAppointment[],
    patientMap: Map<string, VetAppointmentObject['patient']>,
  ): Promise<VetAppointmentObject[]> {
    const missingPetIds = appointments
      .map((appointment) => appointment.petId)
      .filter((petId) => !patientMap.has(petId));
    if (missingPetIds.length) {
      const pets = await this.ownerPetsClient.fetchPetsByIds(missingPetIds);
      for (const pet of pets) {
        patientMap.set(pet.id, {
          id: pet.id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          ownerFirstName: pet.owner.firstName,
          ownerLastName: pet.owner.lastName,
          ownerEmail: pet.owner.email,
        });
      }
    }

    const mapped: VetAppointmentObject[] = [];
    for (const appointment of appointments) {
      const patient = patientMap.get(appointment.petId);
      if (!patient) {
        continue;
      }
      mapped.push({
        id: appointment.id,
        petId: appointment.petId,
        scheduledAt: new Date(appointment.scheduledAt),
        type: appointment.type,
        status: appointment.status as AppointmentStatus,
        reason: appointment.reason,
        notes: appointment.notes,
        clinicName: appointment.clinicName,
        veterinarianName: appointment.veterinarianName,
        clinicId: appointment.vetClinicId,
        patient,
      });
    }

    return mapped.sort(
      (left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime(),
    );
  }
}
