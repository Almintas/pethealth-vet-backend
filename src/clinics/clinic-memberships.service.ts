import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClinicMembershipStatus } from '../common/enums/clinic-membership-status.enum';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import {
  ClinicMembership,
  ClinicMembershipDocument,
} from './schemas/clinic-membership.schema';
import { ClinicsService } from './clinics.service';

export interface CreateClinicMembershipInput {
  veterinarianProfileId: string;
  clinicId: string;
}

@Injectable()
export class ClinicMembershipsService {
  constructor(
    @InjectModel(ClinicMembership.name)
    private readonly membershipModel: Model<ClinicMembershipDocument>,
    private readonly clinicsService: ClinicsService,
    private readonly veterinariansService: VeterinariansService,
  ) {}

  async addMembership(
    input: CreateClinicMembershipInput,
  ): Promise<ClinicMembershipDocument> {
    await this.veterinariansService.findById(input.veterinarianProfileId);
    await this.clinicsService.findById(input.clinicId);

    const veterinarianProfileId = new Types.ObjectId(
      input.veterinarianProfileId,
    );
    const clinicId = new Types.ObjectId(input.clinicId);

    const existing = await this.membershipModel.findOne({
      veterinarianProfileId,
      clinicId,
    });
    if (existing) {
      throw new ConflictException('Clinic membership already exists');
    }

    const membership = new this.membershipModel({
      veterinarianProfileId,
      clinicId,
      status: ClinicMembershipStatus.ACTIVE,
    });
    return membership.save();
  }

  async assertActiveMembership(
    veterinarianProfileId: string,
    clinicId: string,
  ): Promise<void> {
    const membership = await this.membershipModel.findOne({
      veterinarianProfileId: new Types.ObjectId(veterinarianProfileId),
      clinicId: new Types.ObjectId(clinicId),
      status: ClinicMembershipStatus.ACTIVE,
    });
    if (!membership) {
      throw new ForbiddenException('No active membership for this clinic');
    }
  }

  async listClinicsForVeterinarian(
    veterinarianProfileId: string,
  ): Promise<ClinicMembershipDocument[]> {
    await this.veterinariansService.findById(veterinarianProfileId);
    return this.membershipModel
      .find({
        veterinarianProfileId: new Types.ObjectId(veterinarianProfileId),
        status: ClinicMembershipStatus.ACTIVE,
      })
      .exec();
  }

  async findById(id: string): Promise<ClinicMembershipDocument> {
    const membership = await this.membershipModel.findById(id).exec();
    if (!membership) {
      throw new NotFoundException('Clinic membership not found');
    }
    return membership;
  }
}
