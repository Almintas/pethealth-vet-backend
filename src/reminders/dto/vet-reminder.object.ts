import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('VetPatientReminder', {
  description:
    'A reminder for the pet owner that a clinic set, or that was created automatically from a clinic record',
})
export class VetReminderObject {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  petId!: string;

  @Field({ description: 'VACCINATION, MEDICATION, APPOINTMENT or GENERAL' })
  type!: string;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  message?: string | null;

  @Field(() => GraphQLISODateTime)
  dueAt!: Date;

  @Field({ description: 'PENDING, COMPLETED (by the owner) or DISMISSED' })
  status!: string;

  @Field({ description: 'CLINIC or AUTOMATIC' })
  managedBy!: string;

  @Field(() => ID, { nullable: true })
  clinicId?: string | null;

  @Field(() => String, { nullable: true })
  clinicName?: string | null;

  @Field(() => String, { nullable: true })
  createdByName?: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}
