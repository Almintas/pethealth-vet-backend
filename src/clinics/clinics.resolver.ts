import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { GqlRolesGuard } from '../auth/guards/gql-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { CreateClinicInput } from './dto/create-clinic.input';
import { ClinicObject } from './dto/clinic.object';
import { ClinicsService } from './clinics.service';

@Resolver()
export class ClinicsResolver {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Mutation(() => ClinicObject)
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles(UserRole.VETERINARIAN, UserRole.CLINIC_ADMIN)
  createClinic(
    @CurrentUser() user: UserDocument,
    @Args('input') input: CreateClinicInput,
  ): Promise<ClinicObject> {
    return this.clinicsService.createClinicForUser(user._id.toString(), input);
  }

  @Query(() => [ClinicObject], { name: 'myClinics' })
  @UseGuards(GqlAuthGuard)
  myClinics(@CurrentUser() user: UserDocument): Promise<ClinicObject[]> {
    return this.clinicsService.findMyClinics(user._id.toString());
  }
}
