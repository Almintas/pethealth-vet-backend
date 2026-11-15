import { Field, ID, ObjectType } from '@nestjs/graphql';
import { AccountApprovalStatus } from '../../common/enums/account-approval-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';

@ObjectType('AdminVeterinarian', {
  description:
    'A vet-side account as seen by PetHealth staff reviewing approvals',
})
export class AdminVeterinarianObject {
  @Field(() => ID)
  userId!: string;

  @Field()
  email!: string;

  @Field(() => UserRole)
  role!: UserRole;

  @Field(() => AccountApprovalStatus)
  approvalStatus!: AccountApprovalStatus;

  @Field(() => String, { nullable: true })
  firstName?: string | null;

  @Field(() => String, { nullable: true })
  lastName?: string | null;

  @Field(() => String, { nullable: true })
  licenseNumber?: string | null;

  @Field()
  registeredAt!: Date;
}
