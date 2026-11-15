import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Connection } from 'mongoose';
import {
  ClinicMemberRole,
  effectiveClinicMemberRole,
} from '../common/enums/clinic-member-role.enum';
import { ClinicMembershipStatus } from '../common/enums/clinic-membership-status.enum';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { mapClinicToObject } from './clinics.mapper';
import { ClinicObject } from './dto/clinic.object';
import { CreateClinicInput } from './dto/create-clinic.input';
import {
  ClinicMembership,
  ClinicMembershipDocument,
} from './schemas/clinic-membership.schema';
import { Clinic, ClinicDocument } from './schemas/clinic.schema';

export interface CreateClinicServiceInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

const TRANSACTION_UNSUPPORTED_PATTERN =
  /Transaction numbers are only allowed on a replica set member|replica set|does not support retryable writes|Transactions are not supported/i;

/**
 * True when MongoDB runs as a standalone server (typical local setup), where
 * transactions are unavailable. Newer drivers report this as "does not support
 * retryable writes" and keep the original server error in `originalError`, so
 * the whole error chain is checked.
 */
export function isTransactionUnsupportedError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    if (TRANSACTION_UNSUPPORTED_PATTERN.test(current.message)) {
      return true;
    }
    const chained = current as Error & {
      originalError?: unknown;
      cause?: unknown;
    };
    current = chained.originalError ?? chained.cause;
  }
  return false;
}

@Injectable()
export class ClinicsService {
  constructor(
    @InjectModel(Clinic.name)
    private readonly clinicModel: Model<ClinicDocument>,
    @InjectModel(ClinicMembership.name)
    private readonly membershipModel: Model<ClinicMembershipDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly veterinariansService: VeterinariansService,
  ) {}

  async create(input: CreateClinicServiceInput): Promise<ClinicDocument> {
    const clinic = new this.clinicModel({
      name: input.name.trim(),
      email: input.email?.trim().toLowerCase(),
      phone: input.phone?.trim(),
      address: input.address?.trim(),
    });
    return clinic.save();
  }

  /**
   * Creates a clinic and ACTIVE membership for the authenticated user's profile.
   * Uses a MongoDB transaction when supported; otherwise falls back to sequential
   * writes with membership cleanup on clinic persistence failure.
   */
  async createClinicForUser(
    userId: string,
    input: CreateClinicInput,
  ): Promise<ClinicObject> {
    const profile =
      await this.veterinariansService.findOptionalByUserId(userId);
    if (!profile) {
      throw new BadRequestException(
        'A veterinarian profile is required to create a clinic',
      );
    }

    const clinic = await this.createClinicWithMembership(
      profile._id.toString(),
      input,
    );
    return { ...mapClinicToObject(clinic), myRole: ClinicMemberRole.ADMIN };
  }

  async findMyClinics(userId: string): Promise<ClinicObject[]> {
    const profile =
      await this.veterinariansService.findOptionalByUserId(userId);
    if (!profile) {
      return [];
    }

    const memberships = await this.membershipModel
      .find({
        veterinarianProfileId: profile._id,
        status: ClinicMembershipStatus.ACTIVE,
      })
      .exec();

    if (!memberships.length) {
      return [];
    }

    const clinicIds = memberships.map((membership) => membership.clinicId);
    const clinics = await this.clinicModel
      .find({ _id: { $in: clinicIds } })
      .exec();

    const roleByClinicId = new Map(
      memberships.map((membership) => [
        membership.clinicId.toString(),
        effectiveClinicMemberRole(membership.role),
      ]),
    );
    return clinics.map((clinic) => ({
      ...mapClinicToObject(clinic),
      myRole: roleByClinicId.get(clinic._id.toString()) ?? null,
    }));
  }

  async findById(id: string): Promise<ClinicDocument> {
    const clinic = await this.clinicModel.findById(id).exec();
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }
    return clinic;
  }

  async findByIds(ids: Types.ObjectId[]): Promise<ClinicDocument[]> {
    if (!ids.length) {
      return [];
    }
    return this.clinicModel.find({ _id: { $in: ids } }).exec();
  }

  private async createClinicWithMembership(
    veterinarianProfileId: string,
    input: CreateClinicInput,
  ): Promise<ClinicDocument> {
    const profileObjectId = new Types.ObjectId(veterinarianProfileId);

    const clinicPayload = {
      name: input.name.trim(),
      email: input.email?.trim().toLowerCase(),
      phone: input.phone?.trim(),
      address: input.address?.trim(),
    };

    const session = await this.connection.startSession();
    try {
      let createdClinic: ClinicDocument | undefined;
      await session.withTransaction(async () => {
        const [clinic] = await this.clinicModel.create([clinicPayload], {
          session,
        });
        createdClinic = clinic;

        await this.membershipModel.create(
          [
            {
              veterinarianProfileId: profileObjectId,
              clinicId: clinic._id,
              status: ClinicMembershipStatus.ACTIVE,
              role: ClinicMemberRole.ADMIN,
            },
          ],
          { session },
        );
      });
      if (!createdClinic) {
        throw new Error('Clinic creation failed');
      }
      return createdClinic;
    } catch (error) {
      const transactionUnsupported = isTransactionUnsupportedError(error);

      if (!transactionUnsupported) {
        throw error;
      }

      return this.createClinicWithMembershipWithoutTransaction(
        profileObjectId,
        clinicPayload,
      );
    } finally {
      await session.endSession();
    }
  }

  private async createClinicWithMembershipWithoutTransaction(
    veterinarianProfileId: Types.ObjectId,
    clinicPayload: {
      name: string;
      email?: string;
      phone?: string;
      address?: string;
    },
  ): Promise<ClinicDocument> {
    const clinic = await this.create(clinicPayload);
    try {
      await this.membershipModel.create({
        veterinarianProfileId,
        clinicId: clinic._id,
        status: ClinicMembershipStatus.ACTIVE,
        role: ClinicMemberRole.ADMIN,
      });
      return clinic;
    } catch (error) {
      await this.clinicModel.findByIdAndDelete(clinic._id).exec();
      throw error;
    }
  }
}
