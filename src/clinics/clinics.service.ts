import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Clinic, ClinicDocument } from './schemas/clinic.schema';

export interface CreateClinicInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

@Injectable()
export class ClinicsService {
  constructor(
    @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>,
  ) {}

  async create(input: CreateClinicInput): Promise<ClinicDocument> {
    const clinic = new this.clinicModel({
      name: input.name.trim(),
      email: input.email?.trim().toLowerCase(),
      phone: input.phone?.trim(),
      address: input.address?.trim(),
    });
    return clinic.save();
  }

  async findById(id: string): Promise<ClinicDocument> {
    const clinic = await this.clinicModel.findById(id).exec();
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }
    return clinic;
  }
}
