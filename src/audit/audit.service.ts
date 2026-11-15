import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { ClinicPetAccessStatus } from '../common/enums/clinic-pet-access-status.enum';
import { ClinicMembershipStatus } from '../common/enums/clinic-membership-status.enum';
import {
  ClinicPetAccess,
  ClinicPetAccessDocument,
} from '../clinic-pet-access/schemas/clinic-pet-access.schema';
import {
  ClinicMembership,
  ClinicMembershipDocument,
} from '../clinics/schemas/clinic-membership.schema';
import { Clinic, ClinicDocument } from '../clinics/schemas/clinic.schema';
import {
  VeterinarianProfile,
  VeterinarianProfileDocument,
} from '../veterinarians/schemas/veterinarian-profile.schema';
import {
  AuditAction,
  AuditActorType,
  AuditEntityType,
} from './enums/audit.enums';
import { AuditEvent, AuditEventDocument } from './schemas/audit-event.schema';

export type RecordClinicActivityInput = {
  actorUserId: string;
  petId: string;
  /** Pass when known; otherwise resolved from the actor's clinic access to the pet. */
  clinicId?: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  summary?: string | null;
};

export type RecordOwnerActivityInput = {
  petId: string;
  clinicId: string;
  action: AuditAction;
};

/** Repeat views of the same pet by the same person within this window are logged once. */
export const VIEW_DEDUP_WINDOW_MS = 30 * 60 * 1000;
export const MAX_AUDIT_EVENTS_PER_QUERY = 200;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditEvent.name)
    private readonly auditModel: Model<AuditEventDocument>,
    @InjectModel(VeterinarianProfile.name)
    private readonly profileModel: Model<VeterinarianProfileDocument>,
    @InjectModel(ClinicMembership.name)
    private readonly membershipModel: Model<ClinicMembershipDocument>,
    @InjectModel(ClinicPetAccess.name)
    private readonly accessModel: Model<ClinicPetAccessDocument>,
    @InjectModel(Clinic.name)
    private readonly clinicModel: Model<ClinicDocument>,
  ) {}

  /**
   * Records an action by a clinic user. Never throws: a logging failure must
   * not undo or block the clinical action that already succeeded.
   */
  async recordClinicActivity(input: RecordClinicActivityInput): Promise<void> {
    try {
      if (!isValidObjectId(input.actorUserId) || !input.petId) {
        return;
      }
      const actorUserId = new Types.ObjectId(input.actorUserId);

      if (input.action === AuditAction.VIEWED) {
        const recentView = await this.auditModel
          .exists({
            actorUserId,
            petId: input.petId,
            action: AuditAction.VIEWED,
            createdAt: { $gte: new Date(Date.now() - VIEW_DEDUP_WINDOW_MS) },
          })
          .exec();
        if (recentView) {
          return;
        }
      }

      const profile = await this.profileModel
        .findOne({ userId: actorUserId })
        .exec();
      const clinicId =
        input.clinicId && isValidObjectId(input.clinicId)
          ? new Types.ObjectId(input.clinicId)
          : await this.resolveClinicIdForActor(profile, input.petId);
      const clinic = clinicId
        ? await this.clinicModel.findById(clinicId).exec()
        : null;

      await this.auditModel.create({
        petId: input.petId,
        actorType: AuditActorType.CLINIC_USER,
        actorUserId,
        actorName: profile
          ? `${profile.firstName} ${profile.lastName}`.trim()
          : null,
        clinicId,
        clinicName: clinic?.name ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary?.slice(0, 200) ?? null,
      });
    } catch (error) {
      this.logFailure(error);
    }
  }

  /** Records an owner-initiated change, such as revoking a clinic's access. */
  async recordOwnerActivity(input: RecordOwnerActivityInput): Promise<void> {
    try {
      const clinicId = isValidObjectId(input.clinicId)
        ? new Types.ObjectId(input.clinicId)
        : null;
      const clinic = clinicId
        ? await this.clinicModel.findById(clinicId).exec()
        : null;
      await this.auditModel.create({
        petId: input.petId,
        actorType: AuditActorType.OWNER,
        actorUserId: null,
        actorName: null,
        clinicId,
        clinicName: clinic?.name ?? null,
        action: input.action,
        entityType: AuditEntityType.PATIENT,
        entityId: input.petId,
        summary: null,
      });
    } catch (error) {
      this.logFailure(error);
    }
  }

  async listForPet(petId: string, limit = 100): Promise<AuditEventDocument[]> {
    const safeLimit = Math.min(
      Math.max(Math.trunc(limit) || 1, 1),
      MAX_AUDIT_EVENTS_PER_QUERY,
    );
    return this.auditModel
      .find({ petId: petId.trim() })
      .sort({ createdAt: -1, _id: -1 })
      .limit(safeLimit)
      .exec();
  }

  private async resolveClinicIdForActor(
    profile: VeterinarianProfileDocument | null,
    petId: string,
  ): Promise<Types.ObjectId | null> {
    if (!profile) {
      return null;
    }
    const memberships = await this.membershipModel
      .find({
        veterinarianProfileId: profile._id,
        status: ClinicMembershipStatus.ACTIVE,
      })
      .exec();
    if (!memberships.length) {
      return null;
    }
    const access = await this.accessModel
      .findOne({
        petId,
        clinicId: { $in: memberships.map((membership) => membership.clinicId) },
        status: ClinicPetAccessStatus.ACTIVE,
      })
      .sort({ grantedAt: 1 })
      .exec();
    return access?.clinicId ?? null;
  }

  private logFailure(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`Failed to write audit event: ${message}`);
  }
}
