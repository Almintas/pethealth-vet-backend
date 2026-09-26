import { Field, Int, ObjectType } from '@nestjs/graphql';
import { VetMedicationObject } from './medication.object';

@ObjectType()
export class PatientMedicationsPageObject {
  @Field(() => [VetMedicationObject])
  items!: VetMedicationObject[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  limit!: number;

  @Field(() => Int)
  totalPages!: number;

  @Field(() => Int)
  activeTotal!: number;
}
