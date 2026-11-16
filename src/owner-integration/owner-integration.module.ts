import { Module } from '@nestjs/common';
import { OwnerAppointmentsClient } from './owner-appointments.client';
import { OwnerAttachmentsClient } from './owner-attachments.client';
import { OwnerMedicalRecordsClient } from './owner-medical-records.client';
import { OwnerMedicationsClient } from './owner-medications.client';
import { OwnerVaccinationsClient } from './owner-vaccinations.client';
import { OwnerMicrochipClient } from './owner-microchip.client';
import { OwnerPetsClient } from './owner-pets.client';
import { OwnerRemindersClient } from './owner-reminders.client';

@Module({
  providers: [
    OwnerAttachmentsClient,
    OwnerMicrochipClient,
    OwnerRemindersClient,
    OwnerPetsClient,
    OwnerAppointmentsClient,
    OwnerMedicalRecordsClient,
    OwnerMedicationsClient,
    OwnerVaccinationsClient,
  ],
  exports: [
    OwnerAttachmentsClient,
    OwnerMicrochipClient,
    OwnerRemindersClient,
    OwnerPetsClient,
    OwnerAppointmentsClient,
    OwnerMedicalRecordsClient,
    OwnerMedicationsClient,
    OwnerVaccinationsClient,
  ],
})
export class OwnerIntegrationModule {}
