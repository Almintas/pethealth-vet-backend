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

  /** Who last approved/rejected the account (email snapshot), and when. */
  @Prop({ type: String, default: null })
  approvalDecidedBy?: string | null;

  @Prop({ type: Date, default: null })
  approvalDecidedAt?: Date | null;

  /** Two-factor sign-in with an authenticator app (TOTP). */
  @Prop({ type: Boolean, default: false })
  twoFactorEnabled!: boolean;

  /** Encrypted TOTP secret (see two-factor/secret-box.ts). */
  @Prop({ type: String, default: null, select: false })
  twoFactorSecret?: string | null;

  /** Encrypted secret during setup, before the first code is confirmed. */
  @Prop({ type: String, default: null, select: false })
  twoFactorPendingSecret?: string | null;

  /** SHA-256 hashes of unused recovery codes. */
  @Prop({ type: [String], default: [], select: false })
  twoFactorRecoveryCodes?: string[];

  /** Last accepted TOTP time step, so a code can't be replayed. */
  @Prop({ type: Number, default: null, select: false })
  twoFactorLastUsedStep?: number | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
