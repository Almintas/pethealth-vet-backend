import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ClinicMemberRole } from '../../common/enums/clinic-member-role.enum';

export type ClinicInvitationDocument = HydratedDocument<ClinicInvitation>;

/** An emailed invitation to join a clinic. Only the token's hash is stored. */
@Schema({ timestamps: true, collection: 'clinic_invitations' })
export class ClinicInvitation {
  @Prop({ type: Types.ObjectId, ref: 'Clinic', required: true })
  clinicId!: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, enum: ClinicMemberRole, required: true })
  role!: ClinicMemberRole;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  invitedByUserId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  acceptedAt!: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ClinicInvitationSchema =
  SchemaFactory.createForClass(ClinicInvitation);

ClinicInvitationSchema.index({
  clinicId: 1,
  email: 1,
  acceptedAt: 1,
  revokedAt: 1,
});
