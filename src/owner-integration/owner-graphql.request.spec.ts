import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  BadGatewayException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  requestOwnerGraphql,
  toOwnerIntegrationUserMessage,
} from './owner-graphql.request';

function buildConfig(configured = true): ConfigService {
  return {
    get: (key: string) =>
      configured
        ? {
            'owner.graphqlUrl': 'http://owner.test/graphql',
            'owner.serviceSecret': 'secret',
          }[key]
        : undefined,
  } as unknown as ConfigService;
}

const baseOptions = {
  logger: new Logger('test'),
  query: 'query { internalThing { id } }',
  variables: {},
  resultKey: 'internalThing',
  failureMessage: 'Unable to load thing',
  notConfiguredMessage: 'Thing integration is not configured',
};

function mockJson(
  body: unknown,
  ok = true,
  status = 200,
): jest.SpiedFunction<typeof fetch> {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as Response);
}

describe('requestOwnerGraphql', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends the service secret header and returns the result', async () => {
    const fetchMock = mockJson({ data: { internalThing: { id: '1' } } });

    await expect(
      requestOwnerGraphql({ ...baseOptions, configService: buildConfig() }),
    ).resolves.toEqual({ id: '1' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(
      (init.headers as Record<string, string>)['x-pethealth-service-secret'],
    ).toBe('secret');
  });

  it('throws unavailable when the integration is not configured', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');

    await expect(
      requestOwnerGraphql({
        ...baseOptions,
        configService: buildConfig(false),
      }),
    ).rejects.toThrow(
      new ServiceUnavailableException('Thing integration is not configured'),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a null result as missing unless allowed', async () => {
    mockJson({ data: { internalThing: null } });
    await expect(
      requestOwnerGraphql({ ...baseOptions, configService: buildConfig() }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    mockJson({ data: { internalThing: null } });
    await expect(
      requestOwnerGraphql({
        ...baseOptions,
        configService: buildConfig(),
        allowNullResult: true,
      }),
    ).resolves.toBeNull();
  });

  it('hides credential problems behind a support message', async () => {
    mockJson({ errors: [{ message: 'Unauthorized' }] });

    await expect(
      requestOwnerGraphql({ ...baseOptions, configService: buildConfig() }),
    ).rejects.toThrow(
      new BadGatewayException(
        'Owner system integration is not configured correctly. Contact support.',
      ),
    );
  });
});

describe('toOwnerIntegrationUserMessage', () => {
  it.each([
    [
      'A user with this email already exists',
      'A user with this email already exists',
    ],
    ['Bad Request Exception', 'fallback'],
    ['Internal server error', 'fallback'],
    ['  ', 'fallback'],
    [
      'Invalid internal service credentials',
      'Owner system integration is not configured correctly. Contact support.',
    ],
  ])('maps "%s" to "%s"', (ownerMessage, expected) => {
    expect(toOwnerIntegrationUserMessage(ownerMessage, 'fallback')).toBe(
      expected,
    );
  });
});
