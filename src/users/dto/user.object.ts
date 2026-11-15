import { Field, ID, ObjectType } from '@nestjs/graphql';
import { AccountApprovalStatus } from '../../common/enums/account-approval-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { VeterinarianProfileObject } from '../../veterinarians/dto/veterinarian-profile.object';

@ObjectType('User')
export class UserObject {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field(() => UserRole)
  role!: UserRole;

  @Field(() => AccountApprovalStatus)
  approvalStatus!: AccountApprovalStatus;

  @Field({ description: 'Whether sign-in requires an authenticator code' })
  twoFactorEnabled!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => VeterinarianProfileObject, { nullable: true })
  veterinarianProfile?: VeterinarianProfileObject | null;
}
