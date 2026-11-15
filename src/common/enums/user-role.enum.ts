import { registerEnumType } from '@nestjs/graphql';

export enum UserRole {
  VETERINARIAN = 'VETERINARIAN',
  CLINIC_ADMIN = 'CLINIC_ADMIN',
  RECEPTIONIST = 'RECEPTIONIST',
}

registerEnumType(UserRole, {
  name: 'UserRole',
  description: 'Application-level role for authenticated vet users',
});
