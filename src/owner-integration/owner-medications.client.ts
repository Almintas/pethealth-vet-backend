import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OWNER_SERVICE_SECRET_HEADER } from './owner-integration.constants';

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

  private async postGraphql<T>(
    query: string,
    variables: Record<string, unknown>,
    resultKey: keyof NonNullable<OwnerGraphqlResponse['data']>,
    failureMessage: string,
  ): Promise<T> {
    const url = this.configService.get<string>('owner.graphqlUrl')?.trim();
    const secret = this.configService.get<string>('owner.serviceSecret')?.trim();
    if (!url || !secret) {
      throw new ServiceUnavailableException(
        'Owner medication integration is not configured',
      );
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [OWNER_SERVICE_SECRET_HEADER]: secret,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Owner backend responded with HTTP ${response.status} for medications`,
        );
        throw new ServiceUnavailableException(failureMessage);
      }

      const payload = (await response.json()) as OwnerGraphqlResponse;
      if (payload.errors?.length) {
        this.logger.warn(
          `Owner GraphQL error: ${payload.errors[0]?.message ?? 'unknown'}`,
        );
        throw new ServiceUnavailableException(failureMessage);
      }

      const result = payload.data?.[resultKey] as T | undefined;
      if (result === undefined) {
        throw new ServiceUnavailableException(failureMessage);
      }
      return result;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.warn('Owner backend request failed for medications');
      throw new ServiceUnavailableException(failureMessage);
    }
  }
}
