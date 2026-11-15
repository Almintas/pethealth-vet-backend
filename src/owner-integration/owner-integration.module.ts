import { Module } from '@nestjs/common';
import { OwnerAppointmentsClient } from './owner-appointments.client';
import { OwnerMedicalRecordsClient } from './owner-medical-records.client';
import { OwnerMedicationsClient } from './owner-medications.client';
import { OwnerVaccinationsClient } from './owner-vaccinations.client';
import { OwnerPetsClient } from './owner-pets.client';

@Module({
  providers: [
    OwnerPetsClient,
    OwnerAppointmentsClient,
    OwnerMedicalRecordsClient,
    OwnerMedicationsClient,
    OwnerVaccinationsClient,
  ],
  exports: [
    OwnerPetsClient,
    OwnerAppointmentsClient,
    OwnerMedicalRecordsClient,
    OwnerMedicationsClient,
    OwnerVaccinationsClient,
  ],
})
export class OwnerIntegrationModule {}
