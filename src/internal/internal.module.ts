import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ClinicPetAccessModule } from '../clinic-pet-access/clinic-pet-access.module';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { InternalAuditResolver } from './internal-audit.resolver';
import { InternalClinicAccessResolver } from './internal-clinic-access.resolver';

@Module({
  imports: [ClinicPetAccessModule, AuditModule],
  providers: [
    InternalServiceGuard,
    InternalClinicAccessResolver,
    InternalAuditResolver,
  ],
})
export class InternalModule {}
