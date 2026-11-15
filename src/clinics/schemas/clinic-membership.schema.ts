import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ClinicMemberRole } from '../../common/enums/clinic-member-role.enum';
import { ClinicMembershipStatus } from '../../common/enums/clinic-membership-status.enum';

export type ClinicMembershipDocument = HydratedDocument<ClinicMembership>;

/**
 * Links a veterinarian profile to a clinic. Future pet access will be modeled
 * separately (e.g. ClinicPetAccess referencing owner-side Pet ids), not here.
 */
@Schema({ timestamps: true, collection: 'clinic_memberships' })
export class ClinicMembership {
  @Prop({
    type: Types.ObjectId,
    ref: 'VeterinarianProfile',
    required: true,
  })
  veterinarianProfileId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Clinic', required: true })
  clinicId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: ClinicMembershipStatus,
    default: ClinicMembershipStatus.ACTIVE,
  })
  status!: ClinicMembershipStatus;

  /** No default on purpose: legacy memberships (no role) count as ADMIN. */
  @Prop({ type: String, enum: ClinicMemberRole, required: false })
  role?: ClinicMemberRole;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ClinicMembershipSchema =
  SchemaFactory.createForClass(ClinicMembership);

ClinicMembershipSchema.index(
  { veterinarianProfileId: 1, clinicId: 1 },
  { unique: true },
);
