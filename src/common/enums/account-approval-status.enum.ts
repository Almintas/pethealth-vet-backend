import { registerEnumType } from '@nestjs/graphql';

/**
 * Platform approval state for a vet-side account. New registrations start as
 * PENDING; a PetHealth operator verifies the veterinary licence and approves
 * the account before it can create clinics or touch patient data.
 */
export enum AccountApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

registerEnumType(AccountApprovalStatus, {
  name: 'AccountApprovalStatus',
  description: 'Platform approval state for a vet-side account',
});
