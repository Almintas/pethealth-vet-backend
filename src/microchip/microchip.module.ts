import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ClinicPetAccessModule } from '../clinic-pet-access/clinic-pet-access.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { OwnerIntegrationModule } from '../owner-integration/owner-integration.module';
import { VeterinariansModule } from '../veterinarians/veterinarians.module';
import { MicrochipResolver } from './microchip.resolver';
import { MicrochipService } from './microchip.service';

@Module({
  imports: [
    AuditModule,
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ClinicPetAccessModule,
    ClinicsModule,
    VeterinariansModule,
    OwnerIntegrationModule,
  ],
  providers: [MicrochipService, MicrochipResolver],
})
export class MicrochipModule {}
