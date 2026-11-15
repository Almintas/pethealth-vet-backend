import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  AuditAction,
  AuditActorType,
  AuditEntityType,
} from '../enums/audit.enums';

export type AuditEventDocument = HydratedDocument<AuditEvent>;

/**
 * Append-only record of who accessed or changed a pet's data. Actor and clinic
 * names are snapshots, so the log stays readable if a vet or clinic is renamed
 * or removed later.
 */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'audit_events',
})
export class AuditEvent {
  /** Canonical Owner-system pet id. */
  @Prop({ type: String, required: true, trim: true })
  petId!: string;

  @Prop({ type: String, enum: AuditActorType, required: true })
  actorType!: AuditActorType;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  actorUserId!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  actorName!: string | null;

  @Prop({ type: Types.ObjectId, ref: 'Clinic', default: null })
  clinicId!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  clinicName!: string | null;

  @Prop({ type: String, enum: AuditAction, required: true })
  action!: AuditAction;

  @Prop({ type: String, enum: AuditEntityType, required: true })
  entityType!: AuditEntityType;

  @Prop({ type: String, default: null })
  entityId!: string | null;

  /** Short human label, e.g. a record title or vaccine name. */
  @Prop({ type: String, default: null, maxlength: 200 })
  summary!: string | null;

  createdAt!: Date;
}

export const AuditEventSchema = SchemaFactory.createForClass(AuditEvent);

AuditEventSchema.index({ petId: 1, createdAt: -1 });
AuditEventSchema.index({ actorUserId: 1, petId: 1, action: 1, createdAt: -1 });
