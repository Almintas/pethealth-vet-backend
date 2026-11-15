import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { AccountApprovalStatus } from '../../common/enums/account-approval-status.enum';

export type AdminActionDocument = HydratedDocument<AdminAction>;

/** Append-only history of platform admin decisions on vet accounts. */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'admin_actions',
})
export class AdminAction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  adminUserId!: Types.ObjectId;

  @Prop({ required: true })
  adminEmail!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  targetUserId!: Types.ObjectId;

  @Prop({ required: true })
  targetEmail!: string;

  @Prop({ type: String, enum: AccountApprovalStatus, required: true })
  previousStatus!: AccountApprovalStatus;

  @Prop({ type: String, enum: AccountApprovalStatus, required: true })
  newStatus!: AccountApprovalStatus;

  createdAt!: Date;
}

export const AdminActionSchema = SchemaFactory.createForClass(AdminAction);
