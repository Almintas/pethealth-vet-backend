import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { GqlRolesGuard } from '../auth/guards/gql-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { AppointmentsService } from './appointments.service';
import { VetAppointmentObject } from './dto/appointment.object';
import { AppointmentsScheduleQueryInput } from './dto/appointments-schedule-query.input';
import { CreateVetAppointmentInput } from './dto/create-vet-appointment.input';
import { UpdateVetAppointmentInput } from './dto/update-vet-appointment.input';

@Resolver()
export class AppointmentsResolver {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Query(() => [VetAppointmentObject], { name: 'myAppointments' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  myAppointments(
    @CurrentUser() user: UserDocument,
    @Args('query', { type: () => AppointmentsScheduleQueryInput, nullable: true })
    query?: AppointmentsScheduleQueryInput,
  ): Promise<VetAppointmentObject[]> {
    return this.appointmentsService.getMyAppointments(user._id.toString(), query);
  }

  @Query(() => [VetAppointmentObject], { name: 'patientAppointments' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  patientAppointments(
    @CurrentUser() user: UserDocument,
    @Args('patientId', { type: () => ID }) patientId: string,
    @Args('query', { type: () => AppointmentsScheduleQueryInput, nullable: true })
    query?: AppointmentsScheduleQueryInput,
  ): Promise<VetAppointmentObject[]> {
    return this.appointmentsService.getPatientAppointments(
      user._id.toString(),
      patientId,
      query,
    );
  }

  @Query(() => VetAppointmentObject, { name: 'vetAppointment' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  vetAppointment(
    @CurrentUser() user: UserDocument,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<VetAppointmentObject> {
    return this.appointmentsService.getAppointmentById(user._id.toString(), id);
  }

  @Mutation(() => VetAppointmentObject, { name: 'createVetAppointment' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  createVetAppointment(
    @CurrentUser() user: UserDocument,
    @Args('input') input: CreateVetAppointmentInput,
  ): Promise<VetAppointmentObject> {
    return this.appointmentsService.createAppointment(
      user._id.toString(),
      input,
    );
  }

  @Mutation(() => VetAppointmentObject, { name: 'updateVetAppointment' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  updateVetAppointment(
    @CurrentUser() user: UserDocument,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateVetAppointmentInput,
  ): Promise<VetAppointmentObject> {
    return this.appointmentsService.updateAppointment(
      user._id.toString(),
      id,
      input,
    );
  }

  @Mutation(() => VetAppointmentObject, { name: 'cancelVetAppointment' })
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(
    UserRole.VETERINARIAN,
    UserRole.CLINIC_ADMIN,
    UserRole.RECEPTIONIST,
  )
  cancelVetAppointment(
    @CurrentUser() user: UserDocument,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<VetAppointmentObject> {
    return this.appointmentsService.cancelAppointment(user._id.toString(), id);
  }
}
