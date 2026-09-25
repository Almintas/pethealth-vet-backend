import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Clinic } from './schemas/clinic.schema';
import { ClinicsService } from './clinics.service';

describe('ClinicsService', () => {
  let service: ClinicsService;
  const save = jest.fn();
  const clinicModel = jest.fn().mockImplementation((data) => ({
    ...data,
    save,
  })) as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: getModelToken(Clinic.name), useValue: clinicModel },
      ],
    }).compile();

    service = module.get(ClinicsService);
  });

  it('creates a clinic', async () => {
    save.mockResolvedValue({
      _id: 'clinic-id',
      name: 'Happy Paws',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const clinic = await service.create({ name: 'Happy Paws' });
    expect(clinic.name).toBe('Happy Paws');
  });
});
