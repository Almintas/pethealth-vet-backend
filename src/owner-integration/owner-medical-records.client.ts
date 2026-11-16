import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OwnerAttachment } from './owner-attachments.client';
import { requestOwnerGraphql } from './owner-graphql.request';

export type OwnerCanonicalMedicalRecord = {
  id: string;
  petId: string;
  date: string;
  type: string;
  title: string;
  description?: string;
  diagnosis?: string;
  veterinarianName?: string;
  clinicName?: string;
  notes?: string;
  attachments?: OwnerAttachment[];
  createdAt: string;
  updatedAt: string;
};

export type OwnerMedicalRecordsPage = {
  items: OwnerCanonicalMedicalRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type OwnerMedicalRecordsPageQuery = {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
};

type OwnerGraphqlResponse = {
  data?: {
    internalMedicalRecordsByPetIds?: OwnerCanonicalMedicalRecord[];
    internalMedicalRecordsPageForVet?: OwnerMedicalRecordsPage;
    internalMedicalRecordById?: OwnerCanonicalMedicalRecord;
    internalCreateMedicalRecordForVet?: OwnerCanonicalMedicalRecord;
    internalUpdateMedicalRecordForVet?: OwnerCanonicalMedicalRecord;
  };
  errors?: { message: string }[];
};

export type OwnerCreateMedicalRecordPayload = {
  petId: string;
  date: string;
  type: string;
  title: string;
  description?: string;
  diagnosis?: string;
  veterinarianName?: string;
  clinicName?: string;
  notes?: string;
};

export type OwnerUpdateMedicalRecordPayload = {
  date?: string;
  type?: string;
  title?: string;
  description?: string;
  diagnosis?: string;
  veterinarianName?: string;
  clinicName?: string;
  notes?: string;
};

const MEDICAL_RECORD_FIELDS = `
  id
  petId
  date
  type
  title
  description
  diagnosis
  veterinarianName
  clinicName
  notes
  createdAt
  updatedAt
  attachments {
    id
    medicalRecordId
    fileName
    contentType
    size
    clinicId
    clinicName
    uploadedByName
    createdAt
  }
`;

@Injectable()
export class OwnerMedicalRecordsClient {
  private readonly logger = new Logger(OwnerMedicalRecordsClient.name);

  constructor(private readonly configService: ConfigService) {}

  async fetchMedicalRecordsPage(
    petId: string,
    query: OwnerMedicalRecordsPageQuery,
  ): Promise<OwnerMedicalRecordsPage> {
    const input: Record<string, unknown> = {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
    if (query.search?.trim()) {
      input.search = query.search.trim();
    }
    if (query.type?.trim()) {
      input.type = query.type.trim();
    }
    if (query.dateFrom) {
      input.dateFrom = query.dateFrom;
    }
    if (query.dateTo) {
      input.dateTo = query.dateTo;
    }

    return this.executeQuery<OwnerMedicalRecordsPage>(
      `
        query InternalMedicalRecordsPageForVet(
          $petId: ID!
          $query: InternalMedicalRecordsPageInput
        ) {
          internalMedicalRecordsPageForVet(petId: $petId, query: $query) {
            total
            page
            limit
            totalPages
            items {
              ${MEDICAL_RECORD_FIELDS}
            }
          }
        }
      `,
      { petId, query: input },
      'internalMedicalRecordsPageForVet',
      'Unable to load medical records from the Owner system',
    );
  }

  async fetchMedicalRecordsByPetIds(
    petIds: string[],
  ): Promise<OwnerCanonicalMedicalRecord[]> {
    const uniqueIds = [...new Set(petIds.map((id) => id.trim()).filter(Boolean))];
    if (!uniqueIds.length) {
      return [];
    }

    return this.executeQuery<OwnerCanonicalMedicalRecord[]>(
      `
        query InternalMedicalRecordsByPetIds($petIds: [ID!]!) {
          internalMedicalRecordsByPetIds(petIds: $petIds) {
            ${MEDICAL_RECORD_FIELDS}
          }
        }
      `,
      { petIds: uniqueIds },
      'internalMedicalRecordsByPetIds',
      'Unable to load medical records from the Owner system',
    );
  }

  async fetchMedicalRecordById(
    medicalRecordId: string,
  ): Promise<OwnerCanonicalMedicalRecord> {
    return this.executeQuery<OwnerCanonicalMedicalRecord>(
      `
        query InternalMedicalRecordById($medicalRecordId: ID!) {
          internalMedicalRecordById(medicalRecordId: $medicalRecordId) {
            ${MEDICAL_RECORD_FIELDS}
          }
        }
      `,
      { medicalRecordId },
      'internalMedicalRecordById',
      'Unable to load medical record from the Owner system',
    );
  }

  async createMedicalRecord(
    payload: OwnerCreateMedicalRecordPayload,
  ): Promise<OwnerCanonicalMedicalRecord> {
    return this.executeMutation<OwnerCanonicalMedicalRecord>(
      `
        mutation InternalCreateMedicalRecordForVet($input: InternalCreateMedicalRecordForVetInput!) {
          internalCreateMedicalRecordForVet(input: $input) {
            ${MEDICAL_RECORD_FIELDS}
          }
        }
      `,
      { input: payload },
      'internalCreateMedicalRecordForVet',
      'Unable to create medical record in the Owner system',
    );
  }

  async updateMedicalRecord(
    medicalRecordId: string,
    payload: OwnerUpdateMedicalRecordPayload,
  ): Promise<OwnerCanonicalMedicalRecord> {
    return this.executeMutation<OwnerCanonicalMedicalRecord>(
      `
        mutation InternalUpdateMedicalRecordForVet(
          $medicalRecordId: ID!
          $input: InternalUpdateMedicalRecordForVetInput!
        ) {
          internalUpdateMedicalRecordForVet(medicalRecordId: $medicalRecordId, input: $input) {
            ${MEDICAL_RECORD_FIELDS}
          }
        }
      `,
      { medicalRecordId, input: payload },
      'internalUpdateMedicalRecordForVet',
      'Unable to update medical record in the Owner system',
    );
  }

  private async executeQuery<T>(
    query: string,
    variables: Record<string, unknown>,
    resultKey: keyof NonNullable<OwnerGraphqlResponse['data']>,
    failureMessage: string,
  ): Promise<T> {
    return this.postGraphql(query, variables, resultKey, failureMessage);
  }

  private async executeMutation<T>(
    query: string,
    variables: Record<string, unknown>,
    resultKey: keyof NonNullable<OwnerGraphqlResponse['data']>,
    failureMessage: string,
  ): Promise<T> {
    return this.postGraphql(query, variables, resultKey, failureMessage);
  }

  private postGraphql<T>(
    query: string,
    variables: Record<string, unknown>,
    resultKey: keyof NonNullable<OwnerGraphqlResponse['data']>,
    failureMessage: string,
  ): Promise<T> {
    return requestOwnerGraphql<T>({
      configService: this.configService,
      logger: this.logger,
      query,
      variables,
      resultKey,
      failureMessage,
      notConfiguredMessage: 'Owner medical record integration is not configured',
      allowNullResult: true,
    });
  }
}
