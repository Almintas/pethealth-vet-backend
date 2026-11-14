import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requestOwnerGraphql } from './owner-graphql.request';

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
    internalRedeemPetShareCode?: OwnerCanonicalPet;
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

    const pets = await requestOwnerGraphql<OwnerCanonicalPet[] | null>({
      configService: this.configService,
      logger: this.logger,
      query,
      variables: { petIds: uniqueIds },
      resultKey: 'internalPetsByIds',
      failureMessage: 'Unable to load patient data from the Owner system',
      notConfiguredMessage: 'Owner pet integration is not configured',
      allowNullResult: true,
    });
    return pets ?? [];
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

  /**
   * Redeems a one-time share code that the owner generated in the Owner
   * Portal. This is the owner's explicit consent for the clinic to access the
   * pet; the Owner backend marks the code as used and returns the pet.
   */
  async redeemPetShareCode(
    code: string,
    vetClinicId: string,
  ): Promise<OwnerCanonicalPet> {
    return this.executeOwnerMutation<OwnerCanonicalPet>(
      `
        mutation InternalRedeemPetShareCode($code: String!, $vetClinicId: ID!) {
          internalRedeemPetShareCode(code: $code, vetClinicId: $vetClinicId) {
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
      { code, vetClinicId },
      'internalRedeemPetShareCode',
      'Unable to verify the share code with the Owner system',
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

  private executeOwnerMutation<T>(
    query: string,
    variables: Record<string, unknown>,
    resultKey: keyof NonNullable<OwnerGraphqlResponse['data']>,
    failureMessage: string,
  ): Promise<T> {
    // Owner-system errors (e.g. "owner account already exists") reach the
    // clinic user; see requestOwnerGraphql for the full error contract.
    return requestOwnerGraphql<T>({
      configService: this.configService,
      logger: this.logger,
      query,
      variables,
      resultKey,
      failureMessage,
      notConfiguredMessage: 'Owner pet integration is not configured',
    });
  }
}
