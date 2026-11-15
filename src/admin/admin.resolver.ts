import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { GqlRolesGuard } from '../auth/guards/gql-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AccountApprovalStatus } from '../common/enums/account-approval-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminService } from './admin.service';
import { AdminVeterinarianObject } from './dto/admin-veterinarian.object';

/** PetHealth staff tools. Only PLATFORM_ADMIN accounts can call these. */
@Resolver()
@UseGuards(GqlAuthGuard, GqlRolesGuard)
@Roles(UserRole.PLATFORM_ADMIN)
export class AdminResolver {
  constructor(private readonly adminService: AdminService) {}

  @Query(() => [AdminVeterinarianObject], {
    name: 'adminVeterinarians',
    description: 'Vet-side accounts for approval review, newest first',
  })
  adminVeterinarians(
    @Args('status', { type: () => AccountApprovalStatus, nullable: true })
    status?: AccountApprovalStatus | null,
  ): Promise<AdminVeterinarianObject[]> {
    return this.adminService.listVeterinarians(status);
  }

  @Mutation(() => AdminVeterinarianObject, { name: 'approveVeterinarian' })
  approveVeterinarian(
    @Args('userId', { type: () => ID }) userId: string,
  ): Promise<AdminVeterinarianObject> {
    return this.adminService.setApprovalStatus(
      userId,
      AccountApprovalStatus.APPROVED,
    );
  }

  @Mutation(() => AdminVeterinarianObject, { name: 'rejectVeterinarian' })
  rejectVeterinarian(
    @Args('userId', { type: () => ID }) userId: string,
  ): Promise<AdminVeterinarianObject> {
    return this.adminService.setApprovalStatus(
      userId,
      AccountApprovalStatus.REJECTED,
    );
  }
}
