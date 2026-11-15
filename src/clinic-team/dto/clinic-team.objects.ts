import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { AccountApprovalStatus } from '../../common/enums/account-approval-status.enum';
import { ClinicMemberRole } from '../../common/enums/clinic-member-role.enum';

export enum ClinicInvitationState {
  VALID = 'VALID',
  EXPIRED = 'EXPIRED',
  USED = 'USED',
  REVOKED = 'REVOKED',
}

registerEnumType(ClinicInvitationState, {
  name: 'ClinicInvitationState',
  description: 'Whether an invitation link can still be used',
});

@ObjectType('ClinicMember')
export class ClinicMemberObject {
  @Field(() => ID)
  membershipId!: string;

  @Field(() => ID)
  userId!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => ClinicMemberRole)
  role!: ClinicMemberRole;

  @Field(() => AccountApprovalStatus)
  approvalStatus!: AccountApprovalStatus;

  @Field()
  joinedAt!: Date;

  @Field({ description: 'True for the signed-in user' })
  isMe!: boolean;
}

@ObjectType('ClinicInvitation')
export class ClinicInvitationObject {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  clinicId!: string;

  @Field()
  email!: string;

  @Field(() => ClinicMemberRole)
  role!: ClinicMemberRole;

  @Field()
  expiresAt!: Date;

  @Field()
  createdAt!: Date;
}

@ObjectType('CreateClinicInvitationPayload')
export class CreateClinicInvitationPayload {
  @Field(() => ClinicInvitationObject)
  invitation!: ClinicInvitationObject;

  @Field({
    description:
      'Link to share if the email does not arrive. Only returned once, to the inviting admin.',
  })
  inviteUrl!: string;

  @Field()
  emailSent!: boolean;
}

@ObjectType('ClinicInvitationPreview')
export class ClinicInvitationPreviewObject {
  @Field(() => ClinicInvitationState)
  state!: ClinicInvitationState;

  @Field(() => String, { nullable: true })
  clinicName?: string | null;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => ClinicMemberRole, { nullable: true })
  role?: ClinicMemberRole | null;

  @Field({ description: 'Whether an account with the invited email exists' })
  accountExists!: boolean;
}
