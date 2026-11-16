import { AuditModule } from '../audit/audit.module';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { ClinicPetAccessModule } from '../clinic-pet-access/clinic-pet-access.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { OwnerIntegrationModule } from '../owner-integration/owner-integration.module';
import { VeterinariansModule } from '../veterinarians/veterinarians.module';
import { MedicalRecordAttachmentsController } from './medical-record-attachments.controller';
import { MedicalRecordsResolver } from './medical-records.resolver';
import { MedicalRecordsService } from './medical-records.service';

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
  controllers: [MedicalRecordAttachmentsController],
  providers: [MedicalRecordsService, MedicalRecordsResolver],
  exports: [MedicalRecordsService],
})
export class MedicalRecordsModule {}
