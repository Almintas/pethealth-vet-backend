import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { PatientClinicAccessObject } from './patient-clinic-access.object';
import { PatientOwnerObject } from './patient-owner.object';

@ObjectType('Patient')
export class PatientObject {
  @Field(() => ID, { description: 'Canonical Owner Pet id' })
  id!: string;

  @Field()
  name!: string;

  @Field()
  species!: string;

  @Field({ nullable: true })
  breed?: string;

  @Field({ nullable: true })
  gender?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  dateOfBirth?: Date;

  @Field(() => PatientOwnerObject)
  owner!: PatientOwnerObject;

  @Field(() => [PatientClinicAccessObject])
  clinicAccesses!: PatientClinicAccessObject[];
}
