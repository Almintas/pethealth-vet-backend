import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ClinicPetAccess,
  ClinicPetAccessSchema,
} from '../clinic-pet-access/schemas/clinic-pet-access.schema';
import {
  ClinicMembership,
  ClinicMembershipSchema,
} from '../clinics/schemas/clinic-membership.schema';
import { Clinic, ClinicSchema } from '../clinics/schemas/clinic.schema';
import {
  VeterinarianProfile,
  VeterinarianProfileSchema,
} from '../veterinarians/schemas/veterinarian-profile.schema';
import { AuditService } from './audit.service';
import { AuditEvent, AuditEventSchema } from './schemas/audit-event.schema';

/**
 * Registers the models it reads directly (instead of importing the feature
 * modules) so that any feature module, including ClinicPetAccessModule, can
 * import AuditModule without a circular dependency.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditEvent.name, schema: AuditEventSchema },
      { name: VeterinarianProfile.name, schema: VeterinarianProfileSchema },
      { name: ClinicMembership.name, schema: ClinicMembershipSchema },
      { name: ClinicPetAccess.name, schema: ClinicPetAccessSchema },
      { name: Clinic.name, schema: ClinicSchema },
    ]),
  ],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
