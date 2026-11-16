import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requestOwnerGraphql } from './owner-graphql.request';

export type OwnerMicrochipMatch = {
  petId: string;
  name: string;
  species: string;
  breed?: string | null;
};

export type OwnerPetFoundNotice = {
  microchip: string;
  petId: string;
  clinicName: string;
  clinicPhone?: string;
  clinicAddress?: string;
  message?: string;
};

/** Microchip lookup in the Owner backend (no owner details come back). */
@Injectable()
export class OwnerMicrochipClient {
  private readonly logger = new Logger(OwnerMicrochipClient.name);

  constructor(private readonly configService: ConfigService) {}

  findByMicrochip(microchip: string): Promise<OwnerMicrochipMatch[]> {
    return requestOwnerGraphql<OwnerMicrochipMatch[]>({
      configService: this.configService,
      logger: this.logger,
      query: `query ($microchip: String!) { internalPetsByMicrochipForVet(microchip: $microchip) { petId name species breed } }`,
      variables: { microchip },
      resultKey: 'internalPetsByMicrochipForVet',
      failureMessage: 'Unable to search microchips in the Owner system',
      notConfiguredMessage: 'Owner microchip integration is not configured',
    });
  }

  notifyOwner(notice: OwnerPetFoundNotice): Promise<boolean> {
    return requestOwnerGraphql<boolean>({
      configService: this.configService,
      logger: this.logger,
      query: `mutation ($input: InternalNotifyOwnerPetFoundInput!) { internalNotifyOwnerPetFoundForVet(input: $input) }`,
      variables: { input: notice },
      resultKey: 'internalNotifyOwnerPetFoundForVet',
      failureMessage: 'Unable to notify the owner through the Owner system',
      notConfiguredMessage: 'Owner microchip integration is not configured',
    });
  }
}
