import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('InternalClinicAccess')
export class InternalClinicAccessObject {
  @Field(() => ID)
  clinicId!: string;

  @Field()
  clinicName!: string;

  @Field({ nullable: true })
  clinicPhone?: string;

  @Field({ nullable: true })
  clinicAddress?: string;

  @Field()
  grantedAt!: Date;
}
