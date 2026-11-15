import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RATE_LIMITS } from '../common/rate-limit/rate-limit.rules';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthPayload } from '../auth/dto/auth-payload.object';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { GqlRolesGuard } from '../auth/guards/gql-roles.guard';
import { ClinicObject } from '../clinics/dto/clinic.object';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { ClinicTeamService } from './clinic-team.service';
import {
  CreateClinicInvitationInput,
  RegisterWithInvitationInput,
} from './dto/clinic-team.inputs';
import {
  ClinicInvitationObject,
  ClinicInvitationPreviewObject,
  ClinicMemberObject,
  CreateClinicInvitationPayload,
} from './dto/clinic-team.objects';

const CLINIC_STAFF_ROLES = [
  UserRole.VETERINARIAN,
  UserRole.CLINIC_ADMIN,
  UserRole.RECEPTIONIST,
];

@Resolver()
export class ClinicTeamResolver {
  constructor(private readonly clinicTeamService: ClinicTeamService) {}

  @Query(() => [ClinicMemberObject], { name: 'clinicMembers' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(...CLINIC_STAFF_ROLES)
  clinicMembers(
    @CurrentUser() user: UserDocument,
    @Args('clinicId', { type: () => ID }) clinicId: string,
  ): Promise<ClinicMemberObject[]> {
    return this.clinicTeamService.listMembers(user._id.toString(), clinicId);
  }

  @Query(() => [ClinicInvitationObject], {
    name: 'clinicInvitations',
    description: 'Open invitations (clinic administrators only)',
  })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(...CLINIC_STAFF_ROLES)
  clinicInvitations(
    @CurrentUser() user: UserDocument,
    @Args('clinicId', { type: () => ID }) clinicId: string,
  ): Promise<ClinicInvitationObject[]> {
    return this.clinicTeamService.listInvitations(
      user._id.toString(),
      clinicId,
    );
  }

  @Mutation(() => CreateClinicInvitationPayload, {
    name: 'inviteClinicMember',
    description:
      'Email an invitation to join the clinic (clinic administrators only)',
  })
  @RateLimit(RATE_LIMITS.invite)
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(...CLINIC_STAFF_ROLES)
  inviteClinicMember(
    @CurrentUser() user: UserDocument,
    @Args('input') input: CreateClinicInvitationInput,
  ): Promise<CreateClinicInvitationPayload> {
    return this.clinicTeamService.inviteMember(user._id.toString(), input);
  }

  @Mutation(() => Boolean, { name: 'revokeClinicInvitation' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(...CLINIC_STAFF_ROLES)
  revokeClinicInvitation(
    @CurrentUser() user: UserDocument,
    @Args('invitationId', { type: () => ID }) invitationId: string,
  ): Promise<boolean> {
    return this.clinicTeamService.revokeInvitation(
      user._id.toString(),
      invitationId,
    );
  }

  @Mutation(() => Boolean, { name: 'removeClinicMember' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(...CLINIC_STAFF_ROLES)
  removeClinicMember(
    @CurrentUser() user: UserDocument,
    @Args('clinicId', { type: () => ID }) clinicId: string,
    @Args('membershipId', { type: () => ID }) membershipId: string,
  ): Promise<boolean> {
    return this.clinicTeamService.removeMember(
      user._id.toString(),
      clinicId,
      membershipId,
    );
  }

  @Query(() => ClinicInvitationPreviewObject, {
    name: 'clinicInvitationPreview',
    description:
      'Public: what an invitation link is for, so the invite page can explain it',
  })
  @RateLimit(RATE_LIMITS.invitationPreview)
  clinicInvitationPreview(
    @Args('token') token: string,
  ): Promise<ClinicInvitationPreviewObject> {
    return this.clinicTeamService.previewInvitation(token);
  }

  @Mutation(() => ClinicObject, {
    name: 'acceptClinicInvitation',
    description:
      'Join the clinic with the signed-in account (email must match)',
  })
  @RateLimit(RATE_LIMITS.invitationAccept)
  @UseGuards(GqlAuthGuard)
  acceptClinicInvitation(
    @CurrentUser() user: UserDocument,
    @Args('token') token: string,
  ): Promise<ClinicObject> {
    return this.clinicTeamService.acceptInvitation(user._id.toString(), token);
  }

  @Mutation(() => AuthPayload, {
    name: 'registerWithInvitation',
    description: 'Create an account from an invitation and join the clinic',
  })
  @RateLimit(RATE_LIMITS.invitationRegister)
  registerWithInvitation(
    @Args('input') input: RegisterWithInvitationInput,
  ): Promise<AuthPayload> {
    return this.clinicTeamService.registerWithInvitation(input);
  }
}
