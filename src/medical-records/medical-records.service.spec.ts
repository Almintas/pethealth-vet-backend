import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ClinicPetAccessService } from '../clinic-pet-access/clinic-pet-access.service';
import { ClinicMembershipsService } from '../clinics/clinic-memberships.service';
import { ClinicsService } from '../clinics/clinics.service';
import { OwnerAttachmentsClient } from '../owner-integration/owner-attachments.client';
import { OwnerMedicalRecordsClient } from '../owner-integration/owner-medical-records.client';
import { OwnerPetsClient } from '../owner-integration/owner-pets.client';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { MedicalRecordsService } from './medical-records.service';

describe('MedicalRecordsService', () => {
  let service: MedicalRecordsService;

  const clinicPetAccessService = {
    assertUserHasActiveAccessToPet: jest.fn(),
    findActiveAccessForClinicAndPet: jest.fn(),
  };
  const clinicMembershipsService = {
    assertActiveMembership: jest.fn(),
  };
  const clinicsService = {
    findById: jest.fn(),
  };
  const ownerMedicalRecordsClient = {
    fetchMedicalRecordsPage: jest.fn(),
    fetchMedicalRecordById: jest.fn(),
    createMedicalRecord: jest.fn(),
    updateMedicalRecord: jest.fn(),
  };
  const ownerPetsClient = {
    fetchPetsByIds: jest.fn(),
  };
  const veterinariansService = {
    findByUserId: jest.fn(),
  };
  const ownerAttachmentsClient = {
    upload: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
  };

  const userId = new Types.ObjectId().toString();
  const clinicA = new Types.ObjectId().toString();
  const petId = new Types.ObjectId().toString();
  const otherPetId = new Types.ObjectId().toString();
  const recordId = new Types.ObjectId().toString();
  const vetProfileId = new Types.ObjectId();

  const patientSummary = {
    id: petId,
    name: 'Bella',
    species: 'Dog',
    breed: 'Labrador',
    owner: {
      id: 'owner-1',
      firstName: 'Jonas',
      lastName: 'Jonaitis',
      email: 'jonas@example.com',
    },
  };

  const baseRecord = {
    id: recordId,
    petId,
    date: '2026-09-20T00:00:00.000Z',
    type: 'GENERAL_EXAMINATION',
    title: 'Routine annual check-up',
    notes: 'Healthy',
    veterinarianName: 'Dr Vet',
    clinicName: 'Clinic A',
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MedicalRecordsService(
      clinicPetAccessService as unknown as ClinicPetAccessService,
      clinicMembershipsService as unknown as ClinicMembershipsService,
      clinicsService as unknown as ClinicsService,
      ownerMedicalRecordsClient as unknown as OwnerMedicalRecordsClient,
      ownerPetsClient as unknown as OwnerPetsClient,
      veterinariansService as unknown as VeterinariansService,
      ownerAttachmentsClient as unknown as OwnerAttachmentsClient,
    );
    veterinariansService.findByUserId.mockResolvedValue({
      _id: vetProfileId,
      firstName: 'Dr',
      lastName: 'Vet',
    });
    clinicMembershipsService.assertActiveMembership.mockResolvedValue(undefined);
    ownerPetsClient.fetchPetsByIds.mockResolvedValue([patientSummary]);
  });

  it('returns latest page of records for an authorized patient', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: clinicA },
    ]);
    ownerMedicalRecordsClient.fetchMedicalRecordsPage.mockResolvedValue({
      items: [baseRecord],
      total: 52,
      page: 1,
      limit: 5,
      totalPages: 11,
    });

    const page = await service.getMedicalRecordsPageForPatient(userId, petId, {
      page: 1,
      limit: 5,
    });

    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(52);
    expect(ownerMedicalRecordsClient.fetchMedicalRecordsPage).toHaveBeenCalledWith(
      petId,
      { page: 1, limit: 5 },
    );
  });

  it('rejects listing records for an unauthorized patient', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockRejectedValue(
      new ForbiddenException('No access'),
    );

    await expect(
      service.getMedicalRecordsPageForPatient(userId, otherPetId, {
        page: 1,
        limit: 5,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ownerMedicalRecordsClient.fetchMedicalRecordsPage).not.toHaveBeenCalled();
  });

  it('passes search and type filters to the Owner integration', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: clinicA },
    ]);
    ownerMedicalRecordsClient.fetchMedicalRecordsPage.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    await service.getMedicalRecordsPageForPatient(userId, petId, {
      page: 2,
      limit: 20,
      search: 'head',
      type: 'FOLLOW_UP',
      dateFrom: '2026-09-01T00:00:00.000Z',
      dateTo: '2026-09-30T23:59:59.999Z',
    });

    expect(ownerMedicalRecordsClient.fetchMedicalRecordsPage).toHaveBeenCalledWith(
      petId,
      {
        page: 2,
        limit: 20,
        search: 'head',
        type: 'FOLLOW_UP',
        dateFrom: '2026-09-01T00:00:00.000Z',
        dateTo: '2026-09-30T23:59:59.999Z',
      },
    );
  });

  it('creates a record for an authorized patient', async () => {
    clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue({
      petId,
      clinicId: clinicA,
    });
    clinicsService.findById.mockResolvedValue({ name: 'Clinic A' });
    ownerMedicalRecordsClient.createMedicalRecord.mockResolvedValue(baseRecord);

    const record = await service.createMedicalRecord(userId, {
      clinicId: clinicA,
      petId,
      date: new Date(),
      type: 'GENERAL_EXAMINATION',
      title: 'Routine annual check-up',
      notes: 'Healthy',
    });

    expect(ownerMedicalRecordsClient.createMedicalRecord).toHaveBeenCalled();
    expect(record.patient.name).toBe('Bella');
  });

  it('rejects creating a record without clinic patient access', async () => {
    clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue(null);

    await expect(
      service.createMedicalRecord(userId, {
        clinicId: clinicA,
        petId,
        date: new Date(),
        type: 'GENERAL_EXAMINATION',
        title: 'Visit',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ownerMedicalRecordsClient.createMedicalRecord).not.toHaveBeenCalled();
  });

  it('updates an authorized record', async () => {
    ownerMedicalRecordsClient.fetchMedicalRecordById.mockResolvedValue(baseRecord);
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: clinicA },
    ]);
    ownerMedicalRecordsClient.updateMedicalRecord.mockResolvedValue({
      ...baseRecord,
      title: 'Updated title',
    });

    const record = await service.updateMedicalRecord(userId, recordId, {
      title: 'Updated title',
    });

    expect(ownerMedicalRecordsClient.updateMedicalRecord).toHaveBeenCalled();
    expect(record.title).toBe('Updated title');
  });

  it('rejects editing a record when access is revoked', async () => {
    ownerMedicalRecordsClient.fetchMedicalRecordById.mockResolvedValue(baseRecord);
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockRejectedValue(
      new ForbiddenException('No access'),
    );

    await expect(
      service.updateMedicalRecord(userId, recordId, { title: 'Updated' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ownerMedicalRecordsClient.updateMedicalRecord).not.toHaveBeenCalled();
  });

  it('scopes record fetch to the authorized pet on detail view', async () => {
    ownerMedicalRecordsClient.fetchMedicalRecordById.mockResolvedValue({
      ...baseRecord,
      petId: otherPetId,
    });
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockRejectedValue(
      new ForbiddenException('No access'),
    );

    await expect(
      service.getMedicalRecordById(userId, recordId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('handles Owner service failures safely', async () => {
    clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
      { petId, clinicId: clinicA },
    ]);
    ownerMedicalRecordsClient.fetchMedicalRecordsPage.mockRejectedValue(
      new ServiceUnavailableException('Owner down'),
    );

    await expect(
      service.getMedicalRecordsPageForPatient(userId, petId, { page: 1, limit: 5 }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not expose delete operations', () => {
    expect(
      (service as { deleteMedicalRecord?: unknown }).deleteMedicalRecord,
    ).toBeUndefined();
  });

  describe('attachments', () => {
    const file = {
      buffer: Buffer.from('%PDF-1.4'),
      originalname: 'xray.pdf',
      mimetype: 'application/pdf',
    };
    const attachment = {
      id: 'att-1',
      medicalRecordId: recordId,
      fileName: 'xray.pdf',
      contentType: 'application/pdf',
      size: 8,
      clinicId: clinicA,
      clinicName: 'Clinic A',
      uploadedByName: 'Dr Vet',
      createdAt: '2026-11-16T10:00:00.000Z',
    };

    beforeEach(() => {
      ownerMedicalRecordsClient.fetchMedicalRecordById.mockResolvedValue(
        baseRecord,
      );
    });

    it('attaches a file for the clinic with its name and the vet', async () => {
      clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue({
        petId,
        clinicId: clinicA,
      });
      clinicsService.findById.mockResolvedValue({ name: 'Clinic A' });
      ownerAttachmentsClient.upload.mockResolvedValue(attachment);

      const result = await service.addAttachment(
        userId,
        recordId,
        clinicA,
        file,
      );

      expect(ownerAttachmentsClient.upload).toHaveBeenCalledWith(
        recordId,
        file,
        {
          clinicId: clinicA,
          clinicName: 'Clinic A',
          uploadedByName: 'Dr Vet',
        },
      );
      expect(result).toEqual({
        petId,
        recordTitle: 'Routine annual check-up',
        attachment,
      });
    });

    it('refuses to attach without access at the clinic', async () => {
      clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue(
        null,
      );

      await expect(
        service.addAttachment(userId, recordId, clinicA, file),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(ownerAttachmentsClient.upload).not.toHaveBeenCalled();
    });

    it('checks patient access before opening a file', async () => {
      clinicPetAccessService.assertUserHasActiveAccessToPet.mockRejectedValue(
        new ForbiddenException('No access'),
      );

      await expect(
        service.openAttachment(userId, recordId, 'att-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(ownerAttachmentsClient.download).not.toHaveBeenCalled();
    });

    it('removes a file on behalf of the clinic', async () => {
      clinicPetAccessService.findActiveAccessForClinicAndPet.mockResolvedValue({
        petId,
        clinicId: clinicA,
      });
      ownerAttachmentsClient.delete.mockResolvedValue(attachment);

      const result = await service.removeAttachment(
        userId,
        recordId,
        'att-1',
        clinicA,
      );

      expect(ownerAttachmentsClient.delete).toHaveBeenCalledWith(
        recordId,
        'att-1',
        clinicA,
      );
      expect(result.attachment.fileName).toBe('xray.pdf');
    });

    it('returns attachments with the record', async () => {
      clinicPetAccessService.assertUserHasActiveAccessToPet.mockResolvedValue([
        { petId, clinicId: clinicA },
      ]);
      ownerMedicalRecordsClient.fetchMedicalRecordById.mockResolvedValue({
        ...baseRecord,
        attachments: [attachment],
      });

      const record = await service.getMedicalRecordById(userId, recordId);

      expect(record.attachments).toEqual([
        expect.objectContaining({
          id: 'att-1',
          createdAt: new Date('2026-11-16T10:00:00.000Z'),
        }),
      ]);
    });
  });
});
