import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AccountApprovalStatus } from '../common/enums/account-approval-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { AdminService } from './admin.service';

const execOf = (value: unknown) => ({
  exec: jest.fn<() => Promise<unknown>>().mockResolvedValue(value),
});

describe('AdminService', () => {
  const userId = new Types.ObjectId();
  const createdAt = new Date('2026-11-01T10:00:00.000Z');
  const user = {
    _id: userId,
    email: 'vet@clinic.lt',
    role: UserRole.VETERINARIAN,
    approvalStatus: AccountApprovalStatus.PENDING,
    createdAt,
  };
  const profile = {
    userId,
    firstName: 'Ona',
    lastName: 'Vet',
    licenseNumber: 'VET-123',
  };

  const userModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };
  const adminActionModel = { create: jest.fn() };
  const admin = {
    id: new Types.ObjectId().toString(),
    email: 'admin@pethealth.lt',
  };
  const profileModel = { find: jest.fn(), findOne: jest.fn() };
  let service: AdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminService(
      userModel as never,
      profileModel as never,
      adminActionModel as never,
    );
  });

  function mockUserList(users: unknown[]) {
    const limit = jest.fn().mockReturnValue(execOf(users));
    const sort = jest.fn().mockReturnValue({ limit });
    userModel.find.mockReturnValue({ sort });
  }

  it('lists accounts with their licence numbers, excluding platform admins', async () => {
    mockUserList([user]);
    profileModel.find.mockReturnValue(execOf([profile]));

    const result = await service.listVeterinarians();

    expect(userModel.find).toHaveBeenCalledWith({
      role: { $ne: UserRole.PLATFORM_ADMIN },
    });
    expect(result).toEqual([
      {
        userId: userId.toString(),
        email: 'vet@clinic.lt',
        role: UserRole.VETERINARIAN,
        approvalStatus: AccountApprovalStatus.PENDING,
        firstName: 'Ona',
        lastName: 'Vet',
        licenseNumber: 'VET-123',
        registeredAt: createdAt,
        decidedBy: null,
        decidedAt: null,
      },
    ]);
  });

  it('treats legacy accounts without a status as pending', async () => {
    mockUserList([{ ...user, approvalStatus: undefined }]);
    profileModel.find.mockReturnValue(execOf([]));

    const result = await service.listVeterinarians(
      AccountApprovalStatus.PENDING,
    );

    expect(userModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [
          { approvalStatus: AccountApprovalStatus.PENDING },
          { approvalStatus: { $exists: false } },
        ],
      }),
    );
    expect(result[0]?.approvalStatus).toBe(AccountApprovalStatus.PENDING);
    expect(result[0]?.licenseNumber).toBeNull();
  });

  it('approves an account and records who did it', async () => {
    userModel.findOne.mockReturnValue(execOf(user));
    userModel.findOneAndUpdate.mockReturnValue(
      execOf({
        ...user,
        approvalStatus: AccountApprovalStatus.APPROVED,
        approvalDecidedBy: admin.email,
        approvalDecidedAt: new Date('2026-11-15T19:00:00.000Z'),
      }),
    );
    profileModel.findOne.mockReturnValue(execOf(profile));

    const result = await service.setApprovalStatus(
      admin,
      userId.toString(),
      AccountApprovalStatus.APPROVED,
    );

    expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: userId, role: { $ne: UserRole.PLATFORM_ADMIN } },
      {
        $set: expect.objectContaining({
          approvalStatus: AccountApprovalStatus.APPROVED,
          approvalDecidedBy: admin.email,
        }),
      },
      { new: true },
    );
    expect(adminActionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        adminEmail: admin.email,
        targetEmail: 'vet@clinic.lt',
        previousStatus: AccountApprovalStatus.PENDING,
        newStatus: AccountApprovalStatus.APPROVED,
      }),
    );
    expect(result.approvalStatus).toBe(AccountApprovalStatus.APPROVED);
    expect(result.decidedBy).toBe(admin.email);
  });

  it('rejects an invalid id', async () => {
    await expect(
      service.setApprovalStatus(admin, 'nope', AccountApprovalStatus.REJECTED),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cannot change platform admins or unknown accounts', async () => {
    userModel.findOne.mockReturnValue(execOf(null));

    await expect(
      service.setApprovalStatus(
        admin,
        userId.toString(),
        AccountApprovalStatus.REJECTED,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(userModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(adminActionModel.create).not.toHaveBeenCalled();
  });
});
