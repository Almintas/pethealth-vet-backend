import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VeterinariansModule } from '../veterinarians/veterinarians.module';
import { ClinicMembershipsService } from './clinic-memberships.service';
import {
  ClinicMembership,
  ClinicMembershipSchema,
} from './schemas/clinic-membership.schema';
import { Clinic, ClinicSchema } from './schemas/clinic.schema';
import { ClinicsService } from './clinics.service';

@Module({
  imports: [
    VeterinariansModule,
    MongooseModule.forFeature([
      { name: Clinic.name, schema: ClinicSchema },
      { name: ClinicMembership.name, schema: ClinicMembershipSchema },
    ]),
  ],
  providers: [ClinicsService, ClinicMembershipsService],
  exports: [ClinicsService, ClinicMembershipsService, MongooseModule],
})
export class ClinicsModule {}
