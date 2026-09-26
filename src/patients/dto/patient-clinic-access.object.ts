import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { ClinicPetAccessStatus } from '../../common/enums/clinic-pet-access-status.enum';

@ObjectType('PatientClinicAccess')
export class PatientClinicAccessObject {
  @Field(() => ID)
  clinicId!: string;

  @Field(() => ClinicPetAccessStatus)
  accessStatus!: ClinicPetAccessStatus;

  @Field(() => GraphQLISODateTime)
  grantedAt!: Date;
}
