import { Field, ID, ObjectType } from '@nestjs/graphql';

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
}
