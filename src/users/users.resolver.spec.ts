import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { UsersResolver } from './users.resolver';

describe('UsersResolver', () => {
  let resolver: UsersResolver;
  const veterinariansService = {
    findOptionalByUserId: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersResolver,
        { provide: VeterinariansService, useValue: veterinariansService },
      ],
    }).compile();

    resolver = module.get(UsersResolver);
  });

  it('resolves veterinarianProfile for the user', async () => {
    veterinariansService.findOptionalByUserId.mockResolvedValue({
      _id: 'profile-id',
      userId: 'user-id',
      firstName: 'Jane',
      lastName: 'Doe',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const profile = await resolver.veterinarianProfile({
      id: 'user-id',
      email: 'vet@clinic.test',
      role: 'VETERINARIAN' as never,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(profile?.firstName).toBe('Jane');
    expect(veterinariansService.findOptionalByUserId).toHaveBeenCalledWith(
      'user-id',
    );
  });

  it('returns null when profile is missing', async () => {
    veterinariansService.findOptionalByUserId.mockResolvedValue(null);
    const profile = await resolver.veterinarianProfile({
      id: 'user-id',
      email: 'vet@clinic.test',
      role: 'RECEPTIONIST' as never,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(profile).toBeNull();
  });
});
