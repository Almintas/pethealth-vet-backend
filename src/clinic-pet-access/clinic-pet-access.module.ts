import { AuditModule } from '../audit/audit.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { VeterinariansModule } from '../veterinarians/veterinarians.module';
import { ClinicPetAccessResolver } from './clinic-pet-access.resolver';
import { ClinicPetAccessService } from './clinic-pet-access.service';
import {
  ClinicPetAccess,
  ClinicPetAccessSchema,
} from './schemas/clinic-pet-access.schema';

@Module({
  imports: [
    AuditModule,
    AuthModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    VeterinariansModule,
    ClinicsModule,
    MongooseModule.forFeature([
      { name: ClinicPetAccess.name, schema: ClinicPetAccessSchema },
    ]),
  ],
  providers: [ClinicPetAccessService, ClinicPetAccessResolver],
  exports: [ClinicPetAccessService, MongooseModule],
})
export class ClinicPetAccessModule {}
