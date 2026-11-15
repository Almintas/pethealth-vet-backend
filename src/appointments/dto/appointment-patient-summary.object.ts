import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('AppointmentPatientSummary')
export class AppointmentPatientSummaryObject {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  species!: string;

  @Field({ nullable: true })
  breed?: string;

  @Field()
  ownerFirstName!: string;

  @Field()
  ownerLastName!: string;

  @Field({ nullable: true })
  ownerEmail?: string;
}
