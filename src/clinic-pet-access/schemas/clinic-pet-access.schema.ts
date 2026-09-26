import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ClinicPetAccessStatus } from '../../common/enums/clinic-pet-access-status.enum';

export type ClinicPetAccessDocument = HydratedDocument<ClinicPetAccess>;

/**
 * Grants a vet-side clinic authorization to work with a canonical Owner Pet (by petId).
 * Does not duplicate Owner Pet data.
 */
@Schema({ timestamps: true, collection: 'clinic_pet_access' })
export class ClinicPetAccess {
  @Prop({ type: String, required: true, trim: true })
  petId!: string;

  @Prop({ type: Types.ObjectId, ref: 'Clinic', required: true })
  clinicId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: ClinicPetAccessStatus,
    required: true,
    default: ClinicPetAccessStatus.ACTIVE,
  })
  status!: ClinicPetAccessStatus;

  @Prop({ type: Date, required: true, default: () => new Date() })
  grantedAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  grantedBy!: Types.ObjectId | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ClinicPetAccessSchema =
  SchemaFactory.createForClass(ClinicPetAccess);

ClinicPetAccessSchema.index({ clinicId: 1, petId: 1, status: 1 });

ClinicPetAccessSchema.index(
  { clinicId: 1, petId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: ClinicPetAccessStatus.ACTIVE },
  },
);
