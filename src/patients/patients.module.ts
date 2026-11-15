import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { ClinicPetAccessModule } from '../clinic-pet-access/clinic-pet-access.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { OwnerIntegrationModule } from '../owner-integration/owner-integration.module';
import { VeterinariansModule } from '../veterinarians/veterinarians.module';
import { PatientsResolver } from './patients.resolver';
import { PatientsService } from './patients.service';

@Module({
  imports: [
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ClinicPetAccessModule,
    ClinicsModule,
    VeterinariansModule,
    OwnerIntegrationModule,
  ],
  providers: [PatientsService, PatientsResolver],
  exports: [PatientsService],
})
export class PatientsModule {}
