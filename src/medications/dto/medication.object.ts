import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { AppointmentPatientSummaryObject } from '../../appointments/dto/appointment-patient-summary.object';

@ObjectType('VetMedication')
export class VetMedicationObject {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  petId!: string;

  @Field()
  name!: string;

  @Field()
  dosage!: number;

  @Field()
  dosageUnit!: string;

  @Field()
  frequency!: string;

  @Field(() => GraphQLISODateTime)
  startDate!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  endDate?: Date;

  @Field({ nullable: true })
  veterinarianName?: string;

  @Field({ nullable: true })
  clinicName?: string;

  @Field({ nullable: true })
  notes?: string;

  @Field()
  isActive!: boolean;

  @Field(() => AppointmentPatientSummaryObject)
  patient!: AppointmentPatientSummaryObject;
}
