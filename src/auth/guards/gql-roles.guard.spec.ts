import { describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AccountApprovalStatus } from '../../common/enums/account-approval-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { ACCOUNT_NOT_APPROVED_MESSAGE, GqlRolesGuard } from './gql-roles.guard';

describe('GqlRolesGuard', () => {
  it('allows users with required roles', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([UserRole.VETERINARIAN, UserRole.CLINIC_ADMIN]),
    } as unknown as Reflector;
    const guard = new GqlRolesGuard(reflector);
    const context = { getHandler: () => undefined, getClass: () => undefined };
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({
        req: {
          user: {
            role: UserRole.VETERINARIAN,
            approvalStatus: AccountApprovalStatus.APPROVED,
          },
        },
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

  it.each([
    AccountApprovalStatus.PENDING,
    AccountApprovalStatus.REJECTED,
    undefined,
  ])('denies accounts whose approval status is %s', (approvalStatus) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.VETERINARIAN]),
    } as unknown as Reflector;
    const guard = new GqlRolesGuard(reflector);
    const context = { getHandler: () => undefined, getClass: () => undefined };
    jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
      getContext: () => ({
        req: { user: { role: UserRole.VETERINARIAN, approvalStatus } },
      }),
    } as unknown as GqlExecutionContext);

    expect(() => guard.canActivate(context as ExecutionContext)).toThrow(
      ACCOUNT_NOT_APPROVED_MESSAGE,
    );
  });
});
