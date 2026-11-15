import { Field, Int, ObjectType } from '@nestjs/graphql';
import { VetMedicalRecordObject } from './medical-record.object';

@ObjectType()
export class PatientMedicalRecordsPageObject {
  @Field(() => [VetMedicalRecordObject])
  items!: VetMedicalRecordObject[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  limit!: number;

  @Field(() => Int)
  totalPages!: number;
}
