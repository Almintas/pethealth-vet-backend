import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditEntityType } from '../audit/enums/audit.enums';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { GqlRolesGuard } from '../auth/guards/gql-roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { CreateVetReminderInput } from './dto/create-vet-reminder.input';
import { VetReminderObject } from './dto/vet-reminder.object';
import { RemindersService } from './reminders.service';

@Resolver()
@UseGuards(GqlAuthGuard, GqlRolesGuard)
@Roles(UserRole.VETERINARIAN, UserRole.CLINIC_ADMIN, UserRole.RECEPTIONIST)
export class RemindersResolver {
  constructor(
    private readonly remindersService: RemindersService,
    private readonly auditService: AuditService,
  ) {}

  @Query(() => [VetReminderObject], {
    name: 'patientReminders',
    description: 'Reminders clinics set for the owner, and automatic ones',
  })
  patientReminders(
    @CurrentUser() user: UserDocument,
    @Args('patientId', { type: () => ID }) patientId: string,
  ): Promise<VetReminderObject[]> {
    return this.remindersService.listForPatient(user._id.toString(), patientId);
  }

  @Mutation(() => VetReminderObject, { name: 'createVetReminder' })
  async createVetReminder(
    @CurrentUser() user: UserDocument,
    @Args('input') input: CreateVetReminderInput,
  ): Promise<VetReminderObject> {
    const reminder = await this.remindersService.create(
      user._id.toString(),
      input,
    );
    await this.auditService.recordClinicActivity({
      actorUserId: user._id.toString(),
      petId: input.petId,
      clinicId: input.clinicId,
      action: AuditAction.CREATED,
      entityType: AuditEntityType.REMINDER,
      entityId: reminder.id,
      summary: reminder.title,
    });
    return reminder;
  }

  @Mutation(() => VetReminderObject, {
    name: 'deleteVetReminder',
    description: 'Removes a reminder the clinic set',
  })
  async deleteVetReminder(
    @CurrentUser() user: UserDocument,
    @Args('id', { type: () => ID }) id: string,
    @Args('clinicId', { type: () => ID }) clinicId: string,
    @Args('patientId', { type: () => ID }) patientId: string,
  ): Promise<VetReminderObject> {
    const reminder = await this.remindersService.delete(
      user._id.toString(),
      id,
      clinicId,
      patientId,
    );
    await this.auditService.recordClinicActivity({
      actorUserId: user._id.toString(),
      petId: patientId,
      clinicId,
      action: AuditAction.DELETED,
      entityType: AuditEntityType.REMINDER,
      entityId: reminder.id,
      summary: reminder.title,
    });
    return reminder;
  }
}
