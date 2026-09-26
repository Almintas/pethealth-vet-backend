import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OWNER_SERVICE_SECRET_HEADER } from './owner-integration.constants';

export type OwnerCanonicalVaccination = {
  id: string;
  petId: string;
  vaccineName: string;
  administeredAt: string;
  nextDueAt?: string;
  veterinarianName?: string;
  clinicName?: string;
  batchNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type OwnerVaccinationsPage = {
  items: OwnerCanonicalVaccination[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  nextDueVaccineName?: string;
  nextDueAt?: string;
};

export type OwnerVaccinationsPageQuery = {
  page?: number;
  limit?: number;
  search?: string;
  vaccineName?: string;
  administeredFrom?: string;
  administeredTo?: string;
  upcomingOnly?: boolean;
};

type OwnerGraphqlResponse = {
  data?: {
    internalVaccinationsPageForVet?: OwnerVaccinationsPage;
    internalVaccinationById?: OwnerCanonicalVaccination;
    internalCreateVaccinationForVet?: OwnerCanonicalVaccination;
    internalUpdateVaccinationForVet?: OwnerCanonicalVaccination;
  };
  errors?: { message: string }[];
};

export type OwnerCreateVaccinationPayload = {
  petId: string;
  vaccineName: string;
  administeredAt: string;
  nextDueAt?: string;
  veterinarianName?: string;
  clinicName?: string;
  batchNumber?: string;
  notes?: string;
};

export type OwnerUpdateVaccinationPayload = {
  vaccineName?: string;
  administeredAt?: string;
  nextDueAt?: string;
  veterinarianName?: string;
  clinicName?: string;
  batchNumber?: string;
  notes?: string;
};

const VACCINATION_FIELDS = `
  id
  petId
  vaccineName
  administeredAt
  nextDueAt
  veterinarianName
  clinicName
  batchNumber
  notes
  createdAt
  updatedAt
`;

@Injectable()
export class OwnerVaccinationsClient {
  private readonly logger = new Logger(OwnerVaccinationsClient.name);

  constructor(private readonly configService: ConfigService) {}

  async fetchVaccinationsPage(
    petId: string,
    query: OwnerVaccinationsPageQuery,
  ): Promise<OwnerVaccinationsPage> {
    const input: Record<string, unknown> = {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
    if (query.search?.trim()) {
      input.search = query.search.trim();
    }
    if (query.vaccineName?.trim()) {
      input.vaccineName = query.vaccineName.trim();
    }
    if (query.administeredFrom) {
      input.administeredFrom = query.administeredFrom;
    }
    if (query.administeredTo) {
      input.administeredTo = query.administeredTo;
    }
    if (query.upcomingOnly !== undefined) {
      input.upcomingOnly = query.upcomingOnly;
    }

    return this.executeQuery<OwnerVaccinationsPage>(
      `
        query InternalVaccinationsPageForVet(
          $petId: ID!
          $query: InternalVaccinationsPageInput
        ) {
          internalVaccinationsPageForVet(petId: $petId, query: $query) {
            total
            page
            limit
            totalPages
            nextDueVaccineName
            nextDueAt
            items {
              ${VACCINATION_FIELDS}
            }
          }
        }
      `,
      { petId, query: input },
      'internalVaccinationsPageForVet',
      'Unable to load vaccinations from the Owner system',
    );
  }

  async fetchVaccinationById(
    vaccinationId: string,
  ): Promise<OwnerCanonicalVaccination> {
    return this.executeQuery<OwnerCanonicalVaccination>(
      `
        query InternalVaccinationById($vaccinationId: ID!) {
          internalVaccinationById(vaccinationId: $vaccinationId) {
            ${VACCINATION_FIELDS}
          }
        }
      `,
      { vaccinationId },
      'internalVaccinationById',
      'Unable to load vaccination from the Owner system',
    );
  }

  async createVaccination(
    payload: OwnerCreateVaccinationPayload,
  ): Promise<OwnerCanonicalVaccination> {
    return this.executeMutation<OwnerCanonicalVaccination>(
      `
        mutation InternalCreateVaccinationForVet($input: InternalCreateVaccinationForVetInput!) {
          internalCreateVaccinationForVet(input: $input) {
            ${VACCINATION_FIELDS}
          }
        }
      `,
      { input: payload },
      'internalCreateVaccinationForVet',
      'Unable to create vaccination in the Owner system',
    );
  }

  async updateVaccination(
    vaccinationId: string,
    payload: OwnerUpdateVaccinationPayload,
  ): Promise<OwnerCanonicalVaccination> {
    return this.executeMutation<OwnerCanonicalVaccination>(
      `
        mutation InternalUpdateVaccinationForVet(
          $vaccinationId: ID!
          $input: InternalUpdateVaccinationForVetInput!
        ) {
          internalUpdateVaccinationForVet(vaccinationId: $vaccinationId, input: $input) {
            ${VACCINATION_FIELDS}
          }
        }
      `,
      { vaccinationId, input: payload },
      'internalUpdateVaccinationForVet',
      'Unable to update vaccination in the Owner system',
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
        'Owner vaccination integration is not configured',
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
          `Owner backend responded with HTTP ${response.status} for vaccinations`,
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
      this.logger.warn('Owner backend request failed for vaccinations');
      throw new ServiceUnavailableException(failureMessage);
    }
  }
}
