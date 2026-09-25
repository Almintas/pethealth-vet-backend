import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  VeterinarianProfile,
  VeterinarianProfileDocument,
} from './schemas/veterinarian-profile.schema';

export interface CreateVeterinarianProfileInput {
  userId: string;
  firstName: string;
  lastName: string;
  licenseNumber?: string;
}

@Injectable()
export class VeterinariansService {
  constructor(
    @InjectModel(VeterinarianProfile.name)
    private readonly profileModel: Model<VeterinarianProfileDocument>,
  ) {}

  async createProfile(
    input: CreateVeterinarianProfileInput,
  ): Promise<VeterinarianProfileDocument> {
    const userObjectId = new Types.ObjectId(input.userId);
    const existing = await this.profileModel.findOne({ userId: userObjectId });
    if (existing) {
      throw new ConflictException('Veterinarian profile already exists');
    }

    const profile = new this.profileModel({
      userId: userObjectId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      licenseNumber: input.licenseNumber?.trim(),
    });
    return profile.save();
  }

  async findOptionalByUserId(
    userId: string,
  ): Promise<VeterinarianProfileDocument | null> {
    return this.profileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  async findByUserId(userId: string): Promise<VeterinarianProfileDocument> {
    const profile = await this.profileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!profile) {
      throw new NotFoundException('Veterinarian profile not found');
    }
    return profile;
  }

  async findById(id: string): Promise<VeterinarianProfileDocument> {
    const profile = await this.profileModel.findById(id).exec();
    if (!profile) {
      throw new NotFoundException('Veterinarian profile not found');
    }
    return profile;
  }
}
