import { registerEnumType } from '@nestjs/graphql';

export enum ClinicPetAccessStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

registerEnumType(ClinicPetAccessStatus, {
  name: 'ClinicPetAccessStatus',
  description: 'Authorization state for clinic access to an owner-system pet',
});
