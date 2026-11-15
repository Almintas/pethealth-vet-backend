import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ClinicPetAccessStatus } from '../../common/enums/clinic-pet-access-status.enum';
import { ClinicObject } from '../../clinics/dto/clinic.object';

@ObjectType('ClinicPetAccess')
export class ClinicPetAccessObject {
  @Field(() => ID)
  id!: string;

  @Field()
  petId!: string;

  @Field(() => ID)
  clinicId!: string;

  @Field(() => ClinicPetAccessStatus)
  status!: ClinicPetAccessStatus;

  @Field()
  grantedAt!: Date;

  @Field(() => Date, { nullable: true })
  revokedAt?: Date | null;

  @Field(() => ID, { nullable: true })
  grantedBy?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  @Field(() => ClinicObject, { nullable: true })
  clinic?: ClinicObject;
}
