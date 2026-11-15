import { describe, expect, it } from '@jest/globals';
import { UserRole } from './user-role.enum';

describe('UserRole', () => {
  it('includes foundation roles', () => {
    expect(UserRole.VETERINARIAN).toBe('VETERINARIAN');
    expect(UserRole.CLINIC_ADMIN).toBe('CLINIC_ADMIN');
    expect(UserRole.RECEPTIONIST).toBe('RECEPTIONIST');
  });

  it('includes the platform admin role', () => {
    expect(UserRole.PLATFORM_ADMIN).toBe('PLATFORM_ADMIN');
  });
});
