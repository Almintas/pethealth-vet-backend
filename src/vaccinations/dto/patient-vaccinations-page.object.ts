import { Field, GraphQLISODateTime, Int, ObjectType } from '@nestjs/graphql';
import { VetVaccinationObject } from './vaccination.object';

@ObjectType()
export class PatientVaccinationsPageObject {
  @Field(() => [VetVaccinationObject])
  items!: VetVaccinationObject[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  limit!: number;

  @Field(() => Int)
  totalPages!: number;

  @Field({ nullable: true })
  nextDueVaccineName?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  nextDueAt?: Date;
}
