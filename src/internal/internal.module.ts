import { Module } from '@nestjs/common';
import { ClinicPetAccessModule } from '../clinic-pet-access/clinic-pet-access.module';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { InternalClinicAccessResolver } from './internal-clinic-access.resolver';

@Module({
  imports: [ClinicPetAccessModule],
  providers: [InternalServiceGuard, InternalClinicAccessResolver],
})
export class InternalModule {}
