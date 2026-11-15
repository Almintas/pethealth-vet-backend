import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VeterinarianProfileDocument = HydratedDocument<VeterinarianProfile>;

@Schema({ timestamps: true, collection: 'veterinarian_profiles' })
export class VeterinarianProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  firstName!: string;

  @Prop({ required: true, trim: true })
  lastName!: string;

  @Prop({ trim: true })
  licenseNumber?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const VeterinarianProfileSchema =
  SchemaFactory.createForClass(VeterinarianProfile);
