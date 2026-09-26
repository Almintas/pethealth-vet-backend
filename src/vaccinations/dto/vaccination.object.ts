import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { AppointmentPatientSummaryObject } from '../../appointments/dto/appointment-patient-summary.object';

@ObjectType('VetVaccination')
export class VetVaccinationObject {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  petId!: string;

  @Field()
  vaccineName!: string;

  @Field(() => GraphQLISODateTime)
  administeredAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  nextDueAt?: Date;

  @Field({ nullable: true })
  veterinarianName?: string;

  @Field({ nullable: true })
  clinicName?: string;

  @Field({ nullable: true })
  batchNumber?: string;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => AppointmentPatientSummaryObject)
  patient!: AppointmentPatientSummaryObject;
}
