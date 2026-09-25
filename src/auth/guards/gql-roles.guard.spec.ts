import { describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserRole } from '../../common/enums/user-role.enum';
import { GqlRolesGuard } from './gql-roles.guard';

describe('GqlRolesGuard', () => {
  it('allows users with required roles', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([
        UserRole.VETERINARIAN,
        UserRole.CLINIC_ADMIN,
      ]),
    } as unknown as Reflector;
    const guard = new GqlRolesGuard(reflector);
    const context = { getHandler: () => undefined, getClass: () => undefined };
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({
        req: { user: { role: UserRole.VETERINARIAN } },
      }),
    } as unknown as GqlExecutionContext);

    expect(guard.canActivate(context as ExecutionContext)).toBe(true);
  });

  it('denies users without required roles', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.CLINIC_ADMIN]),
    } as unknown as Reflector;
    const guard = new GqlRolesGuard(reflector);
    const context = { getHandler: () => undefined, getClass: () => undefined };
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({
        req: { user: { role: UserRole.RECEPTIONIST } },
      }),
    } as unknown as GqlExecutionContext);

    expect(() => guard.canActivate(context as ExecutionContext)).toThrow(
      ForbiddenException,
    );
  });
});
