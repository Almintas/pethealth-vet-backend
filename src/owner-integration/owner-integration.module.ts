import { Module } from '@nestjs/common';
import { OwnerAppointmentsClient } from './owner-appointments.client';
import { OwnerMedicalRecordsClient } from './owner-medical-records.client';
import { OwnerMedicationsClient } from './owner-medications.client';
import { OwnerPetsClient } from './owner-pets.client';

@Module({
  providers: [
    OwnerPetsClient,
    OwnerAppointmentsClient,
    OwnerMedicalRecordsClient,
    OwnerMedicationsClient,
  ],
  exports: [
    OwnerPetsClient,
    OwnerAppointmentsClient,
    OwnerMedicalRecordsClient,
    OwnerMedicationsClient,
  ],
})
export class OwnerIntegrationModule {}
