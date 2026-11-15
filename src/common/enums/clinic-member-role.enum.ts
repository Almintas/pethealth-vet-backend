import { registerEnumType } from '@nestjs/graphql';

/**
 * A person's role inside one clinic. ADMIN can invite and remove team
 * members. Memberships created before roles existed have no role and are
 * treated as ADMIN (they were created by the clinic's founder).
 */
export enum ClinicMemberRole {
  ADMIN = 'ADMIN',
  VETERINARIAN = 'VETERINARIAN',
  RECEPTIONIST = 'RECEPTIONIST',
}

registerEnumType(ClinicMemberRole, {
  name: 'ClinicMemberRole',
  description: "A person's role inside one clinic",
});

export function effectiveClinicMemberRole(
  role: ClinicMemberRole | null | undefined,
): ClinicMemberRole {
  return role ?? ClinicMemberRole.ADMIN;
}
