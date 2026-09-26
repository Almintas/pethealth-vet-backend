import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClinicPetAccessStatus } from '../common/enums/clinic-pet-access-status.enum';
import { ClinicMembershipsService } from '../clinics/clinic-memberships.service';
import { ClinicsService } from '../clinics/clinics.service';
import { mapClinicToObject } from '../clinics/clinics.mapper';
import { ClinicObject } from '../clinics/dto/clinic.object';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { mapClinicPetAccessToObject } from './clinic-pet-access.mapper';
import { ClinicPetAccessObject } from './dto/clinic-pet-access.object';
import {
  ClinicPetAccess,
  ClinicPetAccessDocument,
} from './schemas/clinic-pet-access.schema';

export interface GrantActiveClinicPetAccessInput {
  clinicId: string;
  petId: string;
  grantedByUserId?: string | null;
}

@Injectable()
export class ClinicPetAccessService {
  constructor(
    @InjectModel(ClinicPetAccess.name)
    private readonly accessModel: Model<ClinicPetAccessDocument>,
    private readonly clinicMembershipsService: ClinicMembershipsService,
    private readonly clinicsService: ClinicsService,
    private readonly veterinariansService: VeterinariansService,
  ) {}

  async findActiveAccessForClinicAndPet(
    clinicId: string,
    petId: string,
  ): Promise<ClinicPetAccessDocument | null> {
    return this.accessModel
      .findOne({
        clinicId: new Types.ObjectId(clinicId),
        petId: petId.trim(),
        status: ClinicPetAccessStatus.ACTIVE,
      })
      .exec();
  }

  async findAccessForClinicAndPet(
    clinicId: string,
    petId: string,
  ): Promise<ClinicPetAccessDocument | null> {
    return this.accessModel
      .findOne({
        clinicId: new Types.ObjectId(clinicId),
        petId: petId.trim(),
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  async hasActiveAccess(clinicId: string, petId: string): Promise<boolean> {
    const access = await this.findActiveAccessForClinicAndPet(clinicId, petId);
    return access !== null;
  }

  async assertUserHasActiveAccessToPet(
    userId: string,
    petId: string,
  ): Promise<ClinicPetAccessDocument[]> {
    const normalizedPetId = petId.trim();
    const accessRecords =
      await this.findActiveAccessForVeterinarianUser(userId);
    const matching = accessRecords.filter(
      (record) => record.petId.trim() === normalizedPetId,
    );
    if (!matching.length) {
      throw new ForbiddenException('No active access to this patient');
    }
    return matching;
  }

  /**
   * Internal grant used by future Owner→Vet integration and tests.
   * Not exposed via GraphQL in this phase.
   */
  async grantActiveAccess(
    input: GrantActiveClinicPetAccessInput,
  ): Promise<ClinicPetAccessDocument> {
    await this.clinicsService.findById(input.clinicId);

    const petId = input.petId.trim();
    const existingActive = await this.findActiveAccessForClinicAndPet(
      input.clinicId,
      petId,
    );
    if (existingActive) {
      throw new ConflictException(
        'Active clinic pet access already exists for this clinic and pet',
      );
    }

    const access = new this.accessModel({
      clinicId: new Types.ObjectId(input.clinicId),
      petId,
      status: ClinicPetAccessStatus.ACTIVE,
      grantedAt: new Date(),
      revokedAt: null,
      grantedBy: input.grantedByUserId
        ? new Types.ObjectId(input.grantedByUserId)
        : null,
    });

    return access.save();
  }

  async findActiveAccessForVeterinarianUser(
    userId: string,
  ): Promise<ClinicPetAccessDocument[]> {
    const profile =
      await this.veterinariansService.findOptionalByUserId(userId);
    if (!profile) {
      return [];
    }

    const memberships =
      await this.clinicMembershipsService.listClinicsForVeterinarian(
        profile._id.toString(),
      );
    if (!memberships.length) {
      return [];
    }

    const clinicIds = memberships.map((membership) => membership.clinicId);
    return this.accessModel
      .find({
        clinicId: { $in: clinicIds },
        status: ClinicPetAccessStatus.ACTIVE,
      })
      .sort({ grantedAt: -1 })
      .exec();
  }

  async findMyPatientAccess(userId: string): Promise<ClinicPetAccessObject[]> {
    const accessRecords =
      await this.findActiveAccessForVeterinarianUser(userId);

    const clinicMap = await this.loadClinicMap(
      accessRecords.map((record) => record.clinicId.toString()),
    );

    return accessRecords.map((record) => ({
      ...mapClinicPetAccessToObject(record),
      clinic: clinicMap.get(record.clinicId.toString()),
    }));
  }

  async revokeAccessForUser(
    userId: string,
    clinicId: string,
    petId: string,
  ): Promise<ClinicPetAccessObject> {
    const profile = await this.veterinariansService.findByUserId(userId);
    await this.clinicMembershipsService.assertActiveMembership(
      profile._id.toString(),
      clinicId,
    );

    const access = await this.findActiveAccessForClinicAndPet(clinicId, petId);
    if (!access) {
      throw new NotFoundException('Active patient access not found');
    }

    access.status = ClinicPetAccessStatus.REVOKED;
    access.revokedAt = new Date();
    await access.save();

    const clinic = await this.clinicsService.findById(clinicId);
    return {
      ...mapClinicPetAccessToObject(access),
      clinic: mapClinicToObject(clinic),
    };
  }

  private async loadClinicMap(
    clinicIds: string[],
  ): Promise<Map<string, ClinicObject>> {
    const uniqueIds = [...new Set(clinicIds)];
    const map = new Map<string, ClinicObject>();

    await Promise.all(
      uniqueIds.map(async (id) => {
        try {
          const clinic = await this.clinicsService.findById(id);
          map.set(id, mapClinicToObject(clinic));
        } catch {
          // Clinic reference missing; omit nested clinic data.
        }
      }),
    );

    return map;
  }
}
