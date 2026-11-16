import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requestOwnerGraphql } from './owner-graphql.request';

export type OwnerReminder = {
  id: string;
  petId: string;
  type: string;
  title: string;
  message?: string | null;
  dueAt: string;
  status: string;
  managedBy: string;
  clinicId?: string | null;
  clinicName?: string | null;
  createdByName?: string | null;
  createdAt: string;
};

export type OwnerCreateReminderPayload = {
  petId: string;
  type: string;
  title: string;
  message?: string;
  dueAt: string;
  clinicId: string;
  clinicName: string;
  createdByName?: string;
};

const REMINDER_FIELDS = `
  id
  petId
  type
  title
  message
  dueAt
  status
  managedBy
  clinicId
  clinicName
  createdByName
  createdAt
`;

/** Reminders for the owner, stored in the Owner backend. */
@Injectable()
export class OwnerRemindersClient {
  private readonly logger = new Logger(OwnerRemindersClient.name);

  constructor(private readonly configService: ConfigService) {}

  listForPet(petId: string): Promise<OwnerReminder[]> {
    return this.request<OwnerReminder[]>(
      `query ($petId: ID!) { internalRemindersForPetForVet(petId: $petId) { ${REMINDER_FIELDS} } }`,
      { petId },
      'internalRemindersForPetForVet',
      'Unable to load reminders from the Owner system',
    );
  }

  create(payload: OwnerCreateReminderPayload): Promise<OwnerReminder> {
    return this.request<OwnerReminder>(
      `mutation ($input: InternalCreateReminderForVetInput!) { internalCreateReminderForVet(input: $input) { ${REMINDER_FIELDS} } }`,
      { input: payload },
      'internalCreateReminderForVet',
      'Unable to create the reminder in the Owner system',
    );
  }

  delete(
    reminderId: string,
    clinicId: string,
    petId: string,
  ): Promise<OwnerReminder> {
    return this.request<OwnerReminder>(
      `mutation ($reminderId: ID!, $clinicId: ID!, $petId: ID!) {
        internalDeleteReminderForVet(reminderId: $reminderId, clinicId: $clinicId, petId: $petId) { ${REMINDER_FIELDS} }
      }`,
      { reminderId, clinicId, petId },
      'internalDeleteReminderForVet',
      'Unable to remove the reminder in the Owner system',
    );
  }

  private request<T>(
    query: string,
    variables: Record<string, unknown>,
    resultKey: string,
    failureMessage: string,
  ): Promise<T> {
    return requestOwnerGraphql<T>({
      configService: this.configService,
      logger: this.logger,
      query,
      variables,
      resultKey,
      failureMessage,
      notConfiguredMessage: 'Owner reminder integration is not configured',
    });
  }
}
