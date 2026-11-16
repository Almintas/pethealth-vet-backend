import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { AppointmentPatientSummaryObject } from '../../appointments/dto/appointment-patient-summary.object';
import { VetMedicalRecordAttachmentObject } from './medical-record-attachment.object';

@ObjectType('VetMedicalRecord')
export class VetMedicalRecordObject {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  petId!: string;

  @Field(() => GraphQLISODateTime)
  date!: Date;

  @Field()
  type!: string;

  @Field()
  title!: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  diagnosis?: string;

  @Field({ nullable: true })
  veterinarianName?: string;

  @Field({ nullable: true })
  clinicName?: string;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => [VetMedicalRecordAttachmentObject], {
    description: 'Files attached to the record, oldest first',
  })
  attachments!: VetMedicalRecordAttachmentObject[];

  @Field(() => AppointmentPatientSummaryObject)
  patient!: AppointmentPatientSummaryObject;
}
