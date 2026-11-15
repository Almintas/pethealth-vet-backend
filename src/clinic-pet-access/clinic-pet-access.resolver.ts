import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditEntityType } from '../audit/enums/audit.enums';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { ClinicPetAccessService } from './clinic-pet-access.service';
import { ClinicPetAccessObject } from './dto/clinic-pet-access.object';

@Resolver()
export class ClinicPetAccessResolver {
  constructor(
    private readonly clinicPetAccessService: ClinicPetAccessService,
    private readonly auditService: AuditService,
  ) {}

  @Query(() => [ClinicPetAccessObject], { name: 'myPatientAccess' })
  @UseGuards(GqlAuthGuard)
  myPatientAccess(
    @CurrentUser() user: UserDocument,
  ): Promise<ClinicPetAccessObject[]> {
    return this.clinicPetAccessService.findMyPatientAccess(user._id.toString());
  }

  @Mutation(() => ClinicPetAccessObject)
  @UseGuards(GqlAuthGuard)
  async revokePatientAccess(
    @CurrentUser() user: UserDocument,
    @Args('clinicId', { type: () => ID }) clinicId: string,
    @Args('petId') petId: string,
  ): Promise<ClinicPetAccessObject> {
    const access = await this.clinicPetAccessService.revokeAccessForUser(
      user._id.toString(),
      clinicId,
      petId,
    );
    await this.auditService.recordClinicActivity({
      actorUserId: user._id.toString(),
      petId,
      clinicId,
      action: AuditAction.ACCESS_REVOKED,
      entityType: AuditEntityType.PATIENT,
      entityId: petId,
    });
    return access;
  }
}
