import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AccountApprovalStatus } from '../../common/enums/account-approval-status.enum';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserDocument } from '../../users/schemas/user.schema';

export const ACCOUNT_NOT_APPROVED_MESSAGE =
  'Your account is awaiting approval by PetHealth. You will be able to work with clinics and patients once it is approved.';

/**
 * Enforces @Roles(...) and, for every role-protected operation, requires the
 * account to be APPROVED. Unapproved accounts can still sign in and read
 * `me`, but cannot create clinics or access patient data.
 */
@Injectable()
export class GqlRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const user = ctx.getContext<{ req: { user?: UserDocument } }>().req.user;
    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Access denied');
    }

    if (user.approvalStatus !== AccountApprovalStatus.APPROVED) {
      throw new ForbiddenException(ACCOUNT_NOT_APPROVED_MESSAGE);
    }

    return true;
  }
}
