import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requestOwnerGraphql } from './owner-graphql.request';

export type OwnerCanonicalMedication = {
  id: string;
  petId: string;
  name: string;
  dosage: number;
  dosageUnit: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  veterinarianName?: string;
  clinicName?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OwnerMedicationsPage = {
  items: OwnerCanonicalMedication[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  activeTotal: number;
};

export type OwnerMedicationsPageQuery = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
};

type OwnerGraphqlResponse = {
  data?: {
    internalMedicationsPageForVet?: OwnerMedicationsPage;
    internalMedicationById?: OwnerCanonicalMedication;
    internalCreateMedicationForVet?: OwnerCanonicalMedication;
    internalUpdateMedicationForVet?: OwnerCanonicalMedication;
  };
  errors?: { message: string }[];
};

export type OwnerCreateMedicationPayload = {
  petId: string;
  name: string;
  dosage: number;
  dosageUnit: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  veterinarianName?: string;
  clinicName?: string;
  notes?: string;
  isActive?: boolean;
};

export type OwnerUpdateMedicationPayload = {
  name?: string;
  dosage?: number;
  dosageUnit?: string;
  frequency?: string;
  startDate?: string;
  endDate?: string;
  veterinarianName?: string;
  clinicName?: string;
  notes?: string;
  isActive?: boolean;
};

const MEDICATION_FIELDS = `
  id
  petId
  name
  dosage
  dosageUnit
  frequency
  startDate
  endDate
  veterinarianName
  clinicName
  notes
  isActive
  createdAt
  updatedAt
`;

@Injectable()
export class OwnerMedicationsClient {
  private readonly logger = new Logger(OwnerMedicationsClient.name);

  constructor(private readonly configService: ConfigService) {}

  async fetchMedicationsPage(
    petId: string,
    query: OwnerMedicationsPageQuery,
  ): Promise<OwnerMedicationsPage> {
    const input: Record<string, unknown> = {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
    if (query.search?.trim()) {
      input.search = query.search.trim();
    }
    if (query.isActive !== undefined) {
      input.isActive = query.isActive;
    }

    return this.executeQuery<OwnerMedicationsPage>(
      `
        query InternalMedicationsPageForVet(
          $petId: ID!
          $query: InternalMedicationsPageInput
        ) {
          internalMedicationsPageForVet(petId: $petId, query: $query) {
            total
            page
            limit
            totalPages
            activeTotal
            items {
              ${MEDICATION_FIELDS}
            }
          }
        }
      `,
      { petId, query: input },
      'internalMedicationsPageForVet',
      'Unable to load medications from the Owner system',
    );
  }

  async fetchMedicationById(
    medicationId: string,
  ): Promise<OwnerCanonicalMedication> {
    return this.executeQuery<OwnerCanonicalMedication>(
      `
        query InternalMedicationById($medicationId: ID!) {
          internalMedicationById(medicationId: $medicationId) {
            ${MEDICATION_FIELDS}
          }
        }
      `,
      { medicationId },
      'internalMedicationById',
      'Unable to load medication from the Owner system',
    );
  }

  async createMedication(
    payload: OwnerCreateMedicationPayload,
  ): Promise<OwnerCanonicalMedication> {
    return this.executeMutation<OwnerCanonicalMedication>(
      `
        mutation InternalCreateMedicationForVet($input: InternalCreateMedicationForVetInput!) {
          internalCreateMedicationForVet(input: $input) {
            ${MEDICATION_FIELDS}
          }
        }
      `,
      { input: payload },
      'internalCreateMedicationForVet',
      'Unable to create medication in the Owner system',
    );
  }

  async updateMedication(
    medicationId: string,
    payload: OwnerUpdateMedicationPayload,
  ): Promise<OwnerCanonicalMedication> {
    return this.executeMutation<OwnerCanonicalMedication>(
      `
        mutation InternalUpdateMedicationForVet(
          $medicationId: ID!
          $input: InternalUpdateMedicationForVetInput!
        ) {
          internalUpdateMedicationForVet(medicationId: $medicationId, input: $input) {
            ${MEDICATION_FIELDS}
          }
        }
      `,
      { medicationId, input: payload },
      'internalUpdateMedicationForVet',
      'Unable to update medication in the Owner system',
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
      notConfiguredMessage: 'Owner medication integration is not configured',
      allowNullResult: true,
    });
  }
}
