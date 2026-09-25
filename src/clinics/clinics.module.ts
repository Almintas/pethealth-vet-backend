import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { VeterinariansModule } from '../veterinarians/veterinarians.module';
import { ClinicMembershipsService } from './clinic-memberships.service';
import {
  ClinicMembership,
  ClinicMembershipSchema,
} from './schemas/clinic-membership.schema';
import { Clinic, ClinicSchema } from './schemas/clinic.schema';
import { ClinicsResolver } from './clinics.resolver';
import { ClinicsService } from './clinics.service';

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    VeterinariansModule,
    MongooseModule.forFeature([
      { name: Clinic.name, schema: ClinicSchema },
      { name: ClinicMembership.name, schema: ClinicMembershipSchema },
    ]),
  ],
  providers: [ClinicsService, ClinicMembershipsService, ClinicsResolver],
  exports: [ClinicsService, ClinicMembershipsService, MongooseModule],
})
export class ClinicsModule {}
