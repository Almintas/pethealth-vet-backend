import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requestOwnerGraphql } from './owner-graphql.request';

export type OwnerCanonicalAppointment = {
  id: string;
  petId: string;
  scheduledAt: string;
  type: string;
  vetClinicId?: string;
  clinicName?: string;
  veterinarianName?: string;
  reason?: string;
  notes?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type OwnerGraphqlResponse = {
  data?: {
    internalAppointmentsByPetIds?: OwnerCanonicalAppointment[];
    internalAppointmentById?: OwnerCanonicalAppointment;
    internalCreateAppointmentForVet?: OwnerCanonicalAppointment;
    internalUpdateAppointmentForVet?: OwnerCanonicalAppointment;
  };
  errors?: { message: string }[];
};

export type OwnerCreateAppointmentPayload = {
  petId: string;
  vetClinicId: string;
  scheduledAt: string;
  type: string;
  clinicName?: string;
  veterinarianName?: string;
  reason?: string;
  notes?: string;
  status?: string;
};

export type OwnerUpdateAppointmentPayload = {
  scheduledAt?: string;
  type?: string;
  clinicName?: string;
  veterinarianName?: string;
  reason?: string;
  notes?: string;
  status?: string;
};

@Injectable()
export class OwnerAppointmentsClient {
  private readonly logger = new Logger(OwnerAppointmentsClient.name);

  constructor(private readonly configService: ConfigService) {}

  async fetchAppointmentsByPetIds(
    petIds: string[],
    scheduledFrom?: string,
    scheduledTo?: string,
  ): Promise<OwnerCanonicalAppointment[]> {
    const uniqueIds = [...new Set(petIds.map((id) => id.trim()).filter(Boolean))];
    if (!uniqueIds.length) {
      return [];
    }

    return this.executeQuery<OwnerCanonicalAppointment[]>(
      `
        query InternalAppointmentsByPetIds(
          $petIds: [ID!]!
          $scheduledFrom: DateTime
          $scheduledTo: DateTime
        ) {
          internalAppointmentsByPetIds(
            petIds: $petIds
            scheduledFrom: $scheduledFrom
            scheduledTo: $scheduledTo
          ) {
            id
            petId
            scheduledAt
            type
            vetClinicId
            clinicName
            veterinarianName
            reason
            notes
            status
            createdAt
            updatedAt
          }
        }
      `,
      {
        petIds: uniqueIds,
        scheduledFrom,
        scheduledTo,
      },
      'internalAppointmentsByPetIds',
      'Unable to load appointments from the Owner system',
    );
  }

  async fetchAppointmentById(
    appointmentId: string,
  ): Promise<OwnerCanonicalAppointment> {
    return this.executeQuery<OwnerCanonicalAppointment>(
      `
        query InternalAppointmentById($appointmentId: ID!) {
          internalAppointmentById(appointmentId: $appointmentId) {
            id
            petId
            scheduledAt
            type
            vetClinicId
            clinicName
            veterinarianName
            reason
            notes
            status
            createdAt
            updatedAt
          }
        }
      `,
      { appointmentId },
      'internalAppointmentById',
      'Unable to load appointment from the Owner system',
    );
  }

  async createAppointment(
    payload: OwnerCreateAppointmentPayload,
  ): Promise<OwnerCanonicalAppointment> {
    return this.executeMutation<OwnerCanonicalAppointment>(
      `
        mutation InternalCreateAppointmentForVet($input: InternalCreateAppointmentForVetInput!) {
          internalCreateAppointmentForVet(input: $input) {
            id
            petId
            scheduledAt
            type
            vetClinicId
            clinicName
            veterinarianName
            reason
            notes
            status
            createdAt
            updatedAt
          }
        }
      `,
      { input: payload },
      'internalCreateAppointmentForVet',
      'Unable to create appointment in the Owner system',
    );
  }

  async updateAppointment(
    appointmentId: string,
    payload: OwnerUpdateAppointmentPayload,
  ): Promise<OwnerCanonicalAppointment> {
    return this.executeMutation<OwnerCanonicalAppointment>(
      `
        mutation InternalUpdateAppointmentForVet(
          $appointmentId: ID!
          $input: InternalUpdateAppointmentForVetInput!
        ) {
          internalUpdateAppointmentForVet(appointmentId: $appointmentId, input: $input) {
            id
            petId
            scheduledAt
            type
            vetClinicId
            clinicName
            veterinarianName
            reason
            notes
            status
            createdAt
            updatedAt
          }
        }
      `,
      { appointmentId, input: payload },
      'internalUpdateAppointmentForVet',
      'Unable to update appointment in the Owner system',
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
      notConfiguredMessage: 'Owner appointment integration is not configured',
      allowNullResult: true,
    });
  }
}
