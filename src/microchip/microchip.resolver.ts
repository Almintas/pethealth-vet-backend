import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditEntityType } from '../audit/enums/audit.enums';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { GqlRolesGuard } from '../auth/guards/gql-roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RATE_LIMITS } from '../common/rate-limit/rate-limit.rules';
import type { UserDocument } from '../users/schemas/user.schema';
import {
  MicrochipSearchInput,
  NotifyOwnerAboutFoundPetInput,
} from './dto/microchip.input';
import { MicrochipSearchResultObject } from './dto/microchip-search.object';
import { MicrochipService } from './microchip.service';

@Resolver()
@UseGuards(GqlAuthGuard, GqlRolesGuard)
@Roles(UserRole.VETERINARIAN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST)
export class MicrochipResolver {
  constructor(
    private readonly microchipService: MicrochipService,
    private readonly auditService: AuditService,
  ) {}

  @Query(() => MicrochipSearchResultObject, {
    name: 'microchipSearch',
    description:
      'Finds a pet by microchip. Owner details are never returned; patients with access can be opened.',
  })
  @RateLimit(RATE_LIMITS.microchipSearch)
  async microchipSearch(
    @CurrentUser() user: UserDocument,
    @Args('input') input: MicrochipSearchInput,
  ): Promise<MicrochipSearchResultObject> {
    const result = await this.microchipService.search(
      user._id.toString(),
      input,
    );
    // The owner sees in their activity log that a clinic looked the chip up.
    for (const match of result.matches) {
      await this.auditService.recordClinicActivity({
        actorUserId: user._id.toString(),
        petId: match.petId,
        clinicId: input.clinicId,
        action: AuditAction.MICROCHIP_LOOKUP,
        entityType: AuditEntityType.PATIENT,
        entityId: match.petId,
        summary: result.microchip,
      });
    }
    return result;
  }

  @Mutation(() => Boolean, {
    name: 'notifyOwnerAboutFoundPet',
    description:
      'Emails the owner that their pet is at the clinic, with the clinic contacts. False if no email could be sent.',
  })
  @RateLimit(RATE_LIMITS.microchipNotify)
  async notifyOwnerAboutFoundPet(
    @CurrentUser() user: UserDocument,
    @Args('input') input: NotifyOwnerAboutFoundPetInput,
  ): Promise<boolean> {
    const sent = await this.microchipService.notifyOwner(
      user._id.toString(),
      input,
    );
    await this.auditService.recordClinicActivity({
      actorUserId: user._id.toString(),
      petId: input.petId,
      clinicId: input.clinicId,
      action: AuditAction.OWNER_NOTIFIED,
      entityType: AuditEntityType.PATIENT,
      entityId: input.petId,
      summary: input.message?.slice(0, 200) ?? null,
    });
    return sent;
  }
}
