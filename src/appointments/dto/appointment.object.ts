import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { AppointmentStatus } from '../../common/enums/appointment-status.enum';
import { AppointmentPatientSummaryObject } from './appointment-patient-summary.object';

@ObjectType('VetAppointment')
export class VetAppointmentObject {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  petId!: string;

  @Field(() => GraphQLISODateTime)
  scheduledAt!: Date;

  @Field()
  type!: string;

  @Field(() => AppointmentStatus)
  status!: AppointmentStatus;

  @Field({ nullable: true })
  reason?: string;

  @Field({ nullable: true })
  notes?: string;

  @Field({ nullable: true })
  clinicName?: string;

  @Field({ nullable: true })
  veterinarianName?: string;

  @Field(() => ID, { nullable: true })
  clinicId?: string;

  @Field(() => AppointmentPatientSummaryObject)
  patient!: AppointmentPatientSummaryObject;
}
