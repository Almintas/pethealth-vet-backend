import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { AccountApprovalStatus } from '../common/enums/account-approval-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  VeterinarianProfile,
  VeterinarianProfileDocument,
} from '../veterinarians/schemas/veterinarian-profile.schema';
import { AdminVeterinarianObject } from './dto/admin-veterinarian.object';

export const MAX_ADMIN_LIST_SIZE = 500;

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(VeterinarianProfile.name)
    private readonly profileModel: Model<VeterinarianProfileDocument>,
  ) {}

  /**
   * Vet-side accounts, newest first. PENDING also matches legacy accounts
   * created before approval existed (no approvalStatus field).
   */
  async listVeterinarians(
    status?: AccountApprovalStatus | null,
  ): Promise<AdminVeterinarianObject[]> {
    const statusFilter =
      status === AccountApprovalStatus.PENDING
        ? {
            $or: [
              { approvalStatus: AccountApprovalStatus.PENDING },
              { approvalStatus: { $exists: false } },
            ],
          }
        : status
          ? { approvalStatus: status }
          : {};

    const users = await this.userModel
      .find({ role: { $ne: UserRole.PLATFORM_ADMIN }, ...statusFilter })
      .sort({ createdAt: -1 })
      .limit(MAX_ADMIN_LIST_SIZE)
      .exec();

    const profiles = await this.profileModel
      .find({ userId: { $in: users.map((user) => user._id) } })
      .exec();
    const profileByUserId = new Map(
      profiles.map((profile) => [profile.userId.toString(), profile]),
    );

    return users.map((user) =>
      this.toObject(user, profileByUserId.get(user._id.toString()) ?? null),
    );
  }

  async setApprovalStatus(
    userId: string,
    status: AccountApprovalStatus.APPROVED | AccountApprovalStatus.REJECTED,
  ): Promise<AdminVeterinarianObject> {
    if (!isValidObjectId(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const user = await this.userModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(userId),
          role: { $ne: UserRole.PLATFORM_ADMIN },
        },
        { $set: { approvalStatus: status } },
        { new: true },
      )
      .exec();
    if (!user) {
      throw new NotFoundException('Veterinarian account not found');
    }

    const profile = await this.profileModel
      .findOne({ userId: user._id })
      .exec();
    return this.toObject(user, profile);
  }

  private toObject(
    user: UserDocument,
    profile: VeterinarianProfileDocument | null,
  ): AdminVeterinarianObject {
    return {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      approvalStatus: user.approvalStatus ?? AccountApprovalStatus.PENDING,
      firstName: profile?.firstName ?? null,
      lastName: profile?.lastName ?? null,
      licenseNumber: profile?.licenseNumber ?? null,
      registeredAt: user.createdAt,
    };
  }
}
