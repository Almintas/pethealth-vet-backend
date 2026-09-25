import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('VeterinarianProfile')
export class VeterinarianProfileObject {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  userId!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;

  @Field({ nullable: true })
  licenseNumber?: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
