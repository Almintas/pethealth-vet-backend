import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OwnerAppointmentsClient } from './owner-appointments.client';
import { OwnerMedicalRecordsClient } from './owner-medical-records.client';
import { OwnerMedicationsClient } from './owner-medications.client';
import { OwnerPetsClient } from './owner-pets.client';
import { OwnerVaccinationsClient } from './owner-vaccinations.client';

/*
 * Every owner-integration client must surface Owner-system GraphQL errors to
 * the clinic user (BadGatewayException with the owner's message) instead of a
 * generic "unavailable" error, while network failures stay generic.
 */

type Call = (configService: ConfigService) => Promise<unknown>;

const configService = {
  get: jest.fn((key: string) => {
    if (key === 'owner.graphqlUrl') return 'http://owner.test/graphql';
    if (key === 'owner.serviceSecret') return 'secret';
    return undefined;
  }),
} as unknown as ConfigService;

const payload = {} as never;

const cases: { name: string; resultKey: string; call: Call }[] = [
  {
    name: 'OwnerMedicalRecordsClient.createMedicalRecord',
    resultKey: 'internalCreateMedicalRecordForVet',
    call: (config) =>
      new OwnerMedicalRecordsClient(config).createMedicalRecord(payload),
  },
  {
    name: 'OwnerMedicalRecordsClient.fetchMedicalRecordById',
    resultKey: 'internalMedicalRecordById',
    call: (config) =>
      new OwnerMedicalRecordsClient(config).fetchMedicalRecordById('record-1'),
  },
  {
    name: 'OwnerMedicationsClient.createMedication',
    resultKey: 'internalCreateMedicationForVet',
    call: (config) =>
      new OwnerMedicationsClient(config).createMedication(payload),
  },
  {
    name: 'OwnerMedicationsClient.fetchMedicationById',
    resultKey: 'internalMedicationById',
    call: (config) =>
      new OwnerMedicationsClient(config).fetchMedicationById('medication-1'),
  },
  {
    name: 'OwnerVaccinationsClient.createVaccination',
    resultKey: 'internalCreateVaccinationForVet',
    call: (config) =>
      new OwnerVaccinationsClient(config).createVaccination(payload),
  },
  {
    name: 'OwnerVaccinationsClient.fetchVaccinationById',
    resultKey: 'internalVaccinationById',
    call: (config) =>
      new OwnerVaccinationsClient(config).fetchVaccinationById('vaccination-1'),
  },
  {
    name: 'OwnerAppointmentsClient.createAppointment',
    resultKey: 'internalCreateAppointmentForVet',
    call: (config) =>
      new OwnerAppointmentsClient(config).createAppointment(payload),
  },
  {
    name: 'OwnerAppointmentsClient.fetchAppointmentById',
    resultKey: 'internalAppointmentById',
    call: (config) =>
      new OwnerAppointmentsClient(config).fetchAppointmentById('appointment-1'),
  },
  {
    name: 'OwnerPetsClient.fetchPetsByIds',
    resultKey: 'internalPetsByIds',
    call: (config) => new OwnerPetsClient(config).fetchPetsByIds(['pet-1']),
  },
];

function mockFetch(response: Partial<Response> & { body?: unknown }): void {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.body,
  } as Response);
}

describe.each(cases)('$name', ({ call }) => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes the Owner system error message through to the clinic user', async () => {
    mockFetch({
      body: {
        errors: [{ message: 'Clinic no longer has access to this pet' }],
      },
    });

    const error = await call(configService).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadGatewayException);
    expect((error as BadGatewayException).message).toBe(
      'Clinic no longer has access to this pet',
    );
  });

  it('keeps the owner message when the error comes with a 4xx status', async () => {
    mockFetch({
      ok: false,
      status: 400,
      body: { errors: [{ message: 'Pet not found' }] },
    });

    const error = await call(configService).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadGatewayException);
    expect((error as BadGatewayException).message).toBe('Pet not found');
  });

  it('reports network failures as a generic unavailable error', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('fetch failed'));

    await expect(call(configService)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('reports HTTP failures without a GraphQL body as unavailable', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    } as unknown as Response);

    await expect(call(configService)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
