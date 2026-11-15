import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OwnerPetsClient } from './owner-pets.client';

describe('OwnerPetsClient', () => {
  const configService = {
    get: jest.fn(),
  };

  let client: OwnerPetsClient;

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockImplementation((key: string) => {
      if (key === 'owner.graphqlUrl') {
        return 'http://localhost:3000/graphql';
      }
      if (key === 'owner.serviceSecret') {
        return 'dev-owner-service-secret-change-me';
      }
      return undefined;
    });
    client = new OwnerPetsClient(configService as unknown as ConfigService);
  });

  it('returns an empty list when no pet ids are provided', async () => {
    await expect(client.fetchPetsByIds([])).resolves.toEqual([]);
  });

  it('throws when owner integration is not configured', async () => {
    configService.get.mockReturnValue(undefined);
    await expect(client.fetchPetsByIds(['pet-1'])).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('maps owner GraphQL pet data', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          internalPetsByIds: [
            {
              id: 'pet-1',
              name: 'Luna',
              species: 'Cat',
              owner: {
                id: 'owner-1',
                firstName: 'Jane',
                lastName: 'Owner',
              },
            },
          ],
        },
      }),
    } as Response);

    const pets = await client.fetchPetsByIds(['pet-1']);

    expect(fetchMock).toHaveBeenCalled();
    expect(pets).toHaveLength(1);
    expect(pets[0]?.name).toBe('Luna');
    fetchMock.mockRestore();
  });
});
