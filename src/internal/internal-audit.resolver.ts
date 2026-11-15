import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { AuditService } from '../audit/audit.service';
import { InternalAuditEventObject } from './dto/internal-audit-event.object';
import { InternalServiceGuard } from './guards/internal-service.guard';

/** Lets the Owner backend show owners who accessed or changed their pet's data. */
@Resolver()
export class InternalAuditResolver {
  constructor(private readonly auditService: AuditService) {}

  @Query(() => [InternalAuditEventObject], {
    name: 'internalAuditEventsForPet',
    description: 'Newest-first clinic activity for a pet (max 200)',
  })
  @UseGuards(InternalServiceGuard)
  async internalAuditEventsForPet(
    @Args('petId', { type: () => ID }) petId: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 100 })
    limit: number,
  ): Promise<InternalAuditEventObject[]> {
    const events = await this.auditService.listForPet(petId, limit);
    return events.map((event) => ({
      id: event._id.toString(),
      action: event.action,
      entityType: event.entityType,
      actorType: event.actorType,
      actorName: event.actorName,
      clinicId: event.clinicId?.toString() ?? null,
      clinicName: event.clinicName,
      summary: event.summary,
      createdAt: event.createdAt,
    }));
  }
}
