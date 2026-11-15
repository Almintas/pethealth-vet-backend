import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ClinicDocument = HydratedDocument<Clinic>;

@Schema({ timestamps: true, collection: 'clinics' })
export class Clinic {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  address?: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ClinicSchema = SchemaFactory.createForClass(Clinic);
