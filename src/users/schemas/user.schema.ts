import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AccountApprovalStatus } from '../../common/enums/account-approval-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({
    required: true,
    type: String,
    enum: UserRole,
    default: UserRole.VETERINARIAN,
  })
  role!: UserRole;

  /**
   * Accounts without this field (created before approval existed) are treated
   * as PENDING and must be approved with scripts/approve-veterinarian.mjs.
   */
  @Prop({
    required: true,
    type: String,
    enum: AccountApprovalStatus,
    default: AccountApprovalStatus.PENDING,
  })
  approvalStatus!: AccountApprovalStatus;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
