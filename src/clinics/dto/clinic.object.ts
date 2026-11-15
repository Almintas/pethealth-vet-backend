import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ClinicMemberRole } from '../../common/enums/clinic-member-role.enum';

@ObjectType('Clinic')
export class ClinicObject {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  address?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => ClinicMemberRole, {
    nullable: true,
    description: "The signed-in user's role in this clinic",
  })
  myRole?: ClinicMemberRole | null;
}
