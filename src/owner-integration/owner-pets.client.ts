import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OWNER_SERVICE_SECRET_HEADER } from './owner-integration.constants';

export type OwnerPetOwnerSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
};

export type OwnerCanonicalPet = {
  id: string;
  name: string;
  species: string;
  breed?: string;
  gender?: string;
  birthDate?: string;
  owner: OwnerPetOwnerSummary;
};

type OwnerGraphqlResponse = {
  data?: {
    internalPetsByIds?: OwnerCanonicalPet[];
    internalRegisterPetForVet?: OwnerCanonicalPet;
    internalUpdatePetForVet?: OwnerCanonicalPet;
    internalUpdateOwnerProfileForVet?: OwnerCanonicalPet;
  };
  errors?: { message: string }[];
};

export type OwnerRegisterPetPayload = {
  owner: {
    email: string;
    firstName: string;
    lastName: string;
  };
  name: string;
  species: string;
  breed?: string;
  gender?: string;
  birthDate?: string;
};

export type OwnerUpdatePetPayload = {
  name?: string;
  species?: string;
  breed?: string;
  gender?: string;
  birthDate?: string | null;
};

export type OwnerUpdateOwnerProfilePayload = {
  firstName: string;
  lastName: string;
  email: string;
};

@Injectable()
export class OwnerPetsClient {
  private readonly logger = new Logger(OwnerPetsClient.name);

  constructor(private readonly configService: ConfigService) {}

  async fetchPetsByIds(petIds: string[]): Promise<OwnerCanonicalPet[]> {
    const uniqueIds = [...new Set(petIds.map((id) => id.trim()).filter(Boolean))];
    if (!uniqueIds.length) {
      return [];
    }

    const url = this.configService.get<string>('owner.graphqlUrl')?.trim();
    const secret = this.configService.get<string>('owner.serviceSecret')?.trim();
    if (!url || !secret) {
      throw new ServiceUnavailableException(
        'Owner pet integration is not configured',
      );
    }

    const query = `
      query InternalPetsByIds($petIds: [ID!]!) {
        internalPetsByIds(petIds: $petIds) {
          id
          name
          species
          breed
          gender
          birthDate
          owner {
            id
            firstName
            lastName
            email
          }
        }
      }
    `;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [OWNER_SERVICE_SECRET_HEADER]: secret,
        },
        body: JSON.stringify({
          query,
          variables: { petIds: uniqueIds },
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Owner backend responded with HTTP ${response.status} while loading pets`,
        );
        throw new ServiceUnavailableException(
          'Unable to load patient data from the Owner system',
        );
      }

      const payload = (await response.json()) as OwnerGraphqlResponse;
      if (payload.errors?.length) {
        this.logger.warn(
          `Owner backend GraphQL error while loading pets: ${payload.errors[0]?.message ?? 'unknown error'}`,
        );
        throw new ServiceUnavailableException(
          'Unable to load patient data from the Owner system',
        );
      }

      return payload.data?.internalPetsByIds ?? [];
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.warn('Owner backend request failed while loading pets');
      throw new ServiceUnavailableException(
        'Unable to load patient data from the Owner system',
      );
    }
  }

  async registerPetForVet(
    payload: OwnerRegisterPetPayload,
  ): Promise<OwnerCanonicalPet> {
    return this.executeOwnerMutation<OwnerCanonicalPet>(
      `
        mutation InternalRegisterPetForVet($input: InternalRegisterPetForVetInput!) {
          internalRegisterPetForVet(input: $input) {
            id
            name
            species
            breed
            gender
            birthDate
            owner {
              id
              firstName
              lastName
              email
            }
          }
        }
      `,
      { input: payload },
      'internalRegisterPetForVet',
      'Unable to register patient in the Owner system',
    );
  }

  async updateOwnerProfileForVet(
    petId: string,
    payload: OwnerUpdateOwnerProfilePayload,
  ): Promise<OwnerCanonicalPet> {
    return this.executeOwnerMutation<OwnerCanonicalPet>(
      `
        mutation InternalUpdateOwnerProfileForVet(
          $petId: ID!
          $input: InternalUpdateOwnerProfileForVetInput!
        ) {
          internalUpdateOwnerProfileForVet(petId: $petId, input: $input) {
            id
            name
            species
            breed
            gender
            birthDate
            owner {
              id
              firstName
              lastName
              email
            }
          }
        }
      `,
      { petId, input: payload },
      'internalUpdateOwnerProfileForVet',
      'Unable to update patient owner in the Owner system',
    );
  }

  async updatePetForVet(
    petId: string,
    payload: OwnerUpdatePetPayload,
  ): Promise<OwnerCanonicalPet> {
    return this.executeOwnerMutation<OwnerCanonicalPet>(
      `
        mutation InternalUpdatePetForVet($petId: ID!, $input: InternalUpdatePetForVetInput!) {
          internalUpdatePetForVet(petId: $petId, input: $input) {
            id
            name
            species
            breed
            gender
            birthDate
            owner {
              id
              firstName
              lastName
              email
            }
          }
        }
      `,
      { petId, input: payload },
      'internalUpdatePetForVet',
      'Unable to update patient in the Owner system',
    );
  }

  private async executeOwnerMutation<T>(
    query: string,
    variables: Record<string, unknown>,
    resultKey: keyof NonNullable<OwnerGraphqlResponse['data']>,
    failureMessage: string,
  ): Promise<T> {
    const url = this.configService.get<string>('owner.graphqlUrl')?.trim();
    const secret = this.configService.get<string>('owner.serviceSecret')?.trim();
    if (!url || !secret) {
      throw new ServiceUnavailableException(
        'Owner pet integration is not configured',
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
          `Owner backend responded with HTTP ${response.status} during mutation`,
        );
        throw new ServiceUnavailableException(failureMessage);
      }

      const payload = (await response.json()) as OwnerGraphqlResponse;
      if (payload.errors?.length) {
        const ownerMessage =
          payload.errors[0]?.message?.trim() || 'unknown error';
        this.logger.warn(`Owner backend GraphQL error: ${ownerMessage}`);
        throw new BadGatewayException(
          this.toOwnerIntegrationUserMessage(ownerMessage, failureMessage),
        );
      }

      const result = payload.data?.[resultKey] as T | undefined;
      if (!result) {
        throw new ServiceUnavailableException(failureMessage);
      }
      return result;
    } catch (error) {
      // Keep owner-system errors (e.g. "owner account already exists") so the
      // clinic user sees why the action was refused.
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.warn('Owner backend request failed during mutation');
      throw new ServiceUnavailableException(failureMessage);
    }
  }

  private toOwnerIntegrationUserMessage(
    ownerMessage: string,
    fallback: string,
  ): string {
    const normalized = ownerMessage.toLowerCase();
    if (
      normalized === 'bad request exception' ||
      normalized.includes('validation failed')
    ) {
      return fallback;
    }
    if (
      normalized.includes('unauthorized') ||
      normalized.includes('internal service')
    ) {
      return 'Owner system integration is not configured correctly. Contact support.';
    }
    return ownerMessage;
  }
}
