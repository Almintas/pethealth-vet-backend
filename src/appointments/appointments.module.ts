import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { ClinicPetAccessModule } from '../clinic-pet-access/clinic-pet-access.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { OwnerIntegrationModule } from '../owner-integration/owner-integration.module';
import { VeterinariansModule } from '../veterinarians/veterinarians.module';
import { AppointmentsResolver } from './appointments.resolver';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ClinicPetAccessModule,
    ClinicsModule,
    VeterinariansModule,
    OwnerIntegrationModule,
  ],
  providers: [AppointmentsService, AppointmentsResolver],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
