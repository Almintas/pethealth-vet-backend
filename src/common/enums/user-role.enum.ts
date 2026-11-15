import { registerEnumType } from '@nestjs/graphql';

export enum UserRole {
  VETERINARIAN = 'VETERINARIAN',
  CLINIC_ADMIN = 'CLINIC_ADMIN',
  RECEPTIONIST = 'RECEPTIONIST',
  /**
   * PetHealth staff who verify and approve vet accounts. Has no clinical
   * access. Assigned only with scripts/make-platform-admin.mjs.
   */
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
}

registerEnumType(UserRole, {
  name: 'UserRole',
  description: 'Application-level role for authenticated vet users',
});
