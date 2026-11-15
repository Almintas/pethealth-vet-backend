import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import { AccountApprovalStatus } from '../common/enums/account-approval-status.enum';
import { ClinicMemberRole } from '../common/enums/clinic-member-role.enum';
import { ClinicMembershipStatus } from '../common/enums/clinic-membership-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { ClinicTeamService, INVITATION_TTL_MS } from './clinic-team.service';
import { ClinicInvitationState } from './dto/clinic-team.objects';

const execOf = (value: unknown) => ({
  exec: jest.fn<() => Promise<unknown>>().mockResolvedValue(value),
});
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('ClinicTeamService', () => {
  const adminUserId = new Types.ObjectId();
  const adminProfileId = new Types.ObjectId();
  const clinicId = new Types.ObjectId();
  const token = 'a'.repeat(43);

  const invitationModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  };
  const membershipModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    exists: jest.fn(),
    updateOne: jest.fn(),
  };
  const clinicModel = { findById: jest.fn() };
  const profileModel = { find: jest.fn(), findOne: jest.fn() };
  const userModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    exists: jest.fn(),
  };
  const usersService = { create: jest.fn(), deleteById: jest.fn() };
  const veterinariansService = { createProfile: jest.fn() };
  const authService = { issueAuthPayload: jest.fn() };
  const mailService = { isConfigured: jest.fn(), send: jest.fn() };
  const configService = { get: jest.fn() };

  let service: ClinicTeamService;

  const validInvitation = (overrides: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(),
    clinicId,
    email: 'new@clinic.lt',
    role: ClinicMemberRole.RECEPTIONIST,
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  });

  function mockAdminMembership(role: ClinicMemberRole | undefined) {
    profileModel.findOne.mockReturnValue(
      execOf({
        _id: adminProfileId,
        userId: adminUserId,
        firstName: 'Ona',
        lastName: 'Admin',
      }),
    );
    membershipModel.findOne.mockReturnValue(
      execOf({
        _id: new Types.ObjectId(),
        role,
        status: ClinicMembershipStatus.ACTIVE,
      }),
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClinicTeamService(
      invitationModel as never,
      membershipModel as never,
      clinicModel as never,
      profileModel as never,
      userModel as never,
      usersService as never,
      veterinariansService as never,
      authService as never,
      mailService as never,
      configService as never,
    );
    configService.get.mockImplementation((key: unknown) =>
      key === 'VET_FRONTEND_URL' ? 'https://vet.pethealth.test/' : undefined,
    );
    clinicModel.findById.mockReturnValue(
      execOf({
        _id: clinicId,
        name: 'Paws Clinic',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    invitationModel.updateMany.mockReturnValue(execOf({}));
    mailService.isConfigured.mockReturnValue(true);
    mailService.send.mockResolvedValue({ ok: true } as never);
  });

  describe('inviteMember', () => {
    it('lets a clinic admin invite by email and returns a link', async () => {
      mockAdminMembership(ClinicMemberRole.ADMIN);
      userModel.findOne.mockReturnValue(execOf(null));
      invitationModel.create.mockImplementation(async (doc: unknown) => ({
        _id: new Types.ObjectId(),
        createdAt: new Date(),
        ...(doc as object),
      }));

      const result = await service.inviteMember(adminUserId.toString(), {
        clinicId: clinicId.toString(),
        email: ' New@Clinic.LT ',
        role: ClinicMemberRole.RECEPTIONIST,
      });

      const stored = (
        invitationModel.create.mock.calls[0] as [Record<string, unknown>]
      )[0];
      expect(stored.email).toBe('new@clinic.lt');
      expect(stored.tokenHash).toHaveLength(64);
      expect((stored.expiresAt as Date).getTime()).toBeGreaterThan(
        Date.now() + INVITATION_TTL_MS - 5_000,
      );
      expect(result.inviteUrl).toMatch(
        /^https:\/\/vet\.pethealth\.test\/invite\?token=/,
      );
      const sentToken = decodeURIComponent(
        result.inviteUrl.split('token=')[1] ?? '',
      );
      expect(sha256(sentToken)).toBe(stored.tokenHash);
      expect(result.emailSent).toBe(true);
      expect(invitationModel.updateMany).toHaveBeenCalled();
    });

    it('treats legacy memberships without a role as admins', async () => {
      mockAdminMembership(undefined);
      userModel.findOne.mockReturnValue(execOf(null));
      invitationModel.create.mockResolvedValue({
        _id: new Types.ObjectId(),
        clinicId,
        email: 'x@clinic.lt',
        role: ClinicMemberRole.VETERINARIAN,
        expiresAt: new Date(),
        createdAt: new Date(),
      } as never);

      await expect(
        service.inviteMember(adminUserId.toString(), {
          clinicId: clinicId.toString(),
          email: 'x@clinic.lt',
          role: ClinicMemberRole.VETERINARIAN,
        }),
      ).resolves.toMatchObject({ emailSent: true });
    });

    it('refuses non-admin members', async () => {
      mockAdminMembership(ClinicMemberRole.VETERINARIAN);

      await expect(
        service.inviteMember(adminUserId.toString(), {
          clinicId: clinicId.toString(),
          email: 'x@clinic.lt',
          role: ClinicMemberRole.VETERINARIAN,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(invitationModel.create).not.toHaveBeenCalled();
    });

    it('refuses to invite someone who is already a member', async () => {
      mockAdminMembership(ClinicMemberRole.ADMIN);
      userModel.findOne.mockReturnValue(execOf({ _id: new Types.ObjectId() }));
      membershipModel.exists.mockReturnValue(
        execOf({ _id: new Types.ObjectId() }),
      );

      await expect(
        service.inviteMember(adminUserId.toString(), {
          clinicId: clinicId.toString(),
          email: 'member@clinic.lt',
          role: ClinicMemberRole.VETERINARIAN,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('removeMember', () => {
    it('keeps at least one administrator', async () => {
      mockAdminMembership(ClinicMemberRole.ADMIN);
      const targetId = new Types.ObjectId();
      membershipModel.findOne
        .mockReturnValueOnce(execOf({ role: ClinicMemberRole.ADMIN }))
        .mockReturnValueOnce(
          execOf({
            _id: targetId,
            role: ClinicMemberRole.ADMIN,
            save: jest.fn(),
          }),
        );
      membershipModel.find.mockReturnValue(
        execOf([{ role: ClinicMemberRole.ADMIN }]),
      );

      await expect(
        service.removeMember(
          adminUserId.toString(),
          clinicId.toString(),
          targetId.toString(),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('deactivates a regular member', async () => {
      mockAdminMembership(ClinicMemberRole.ADMIN);
      const save = jest
        .fn<() => Promise<unknown>>()
        .mockResolvedValue(undefined);
      const target = {
        _id: new Types.ObjectId(),
        role: ClinicMemberRole.RECEPTIONIST,
        status: ClinicMembershipStatus.ACTIVE,
        save,
      };
      membershipModel.findOne
        .mockReturnValueOnce(execOf({ role: ClinicMemberRole.ADMIN }))
        .mockReturnValueOnce(execOf(target));

      await expect(
        service.removeMember(
          adminUserId.toString(),
          clinicId.toString(),
          target._id.toString(),
        ),
      ).resolves.toBe(true);
      expect(target.status).toBe(ClinicMembershipStatus.INACTIVE);
      expect(save).toHaveBeenCalled();
    });
  });

  describe('previewInvitation', () => {
    it('describes a valid invitation', async () => {
      invitationModel.findOne.mockReturnValue(execOf(validInvitation()));
      userModel.exists.mockReturnValue(execOf(null));

      await expect(service.previewInvitation(token)).resolves.toEqual({
        state: ClinicInvitationState.VALID,
        clinicName: 'Paws Clinic',
        email: 'new@clinic.lt',
        role: ClinicMemberRole.RECEPTIONIST,
        accountExists: false,
      });
      expect(invitationModel.findOne).toHaveBeenCalledWith({
        tokenHash: sha256(token),
      });
    });

    it('reports used and expired invitations', async () => {
      invitationModel.findOne.mockReturnValue(
        execOf(validInvitation({ acceptedAt: new Date() })),
      );
      userModel.exists.mockReturnValue(execOf(null));
      await expect(service.previewInvitation(token)).resolves.toMatchObject({
        state: ClinicInvitationState.USED,
      });

      invitationModel.findOne.mockReturnValue(
        execOf(validInvitation({ expiresAt: new Date(Date.now() - 1) })),
      );
      await expect(service.previewInvitation(token)).resolves.toMatchObject({
        state: ClinicInvitationState.EXPIRED,
      });
    });
  });

  describe('acceptInvitation', () => {
    it('refuses an account with a different email', async () => {
      invitationModel.findOne.mockReturnValue(execOf(validInvitation()));
      userModel.findById.mockReturnValue(
        execOf({
          _id: new Types.ObjectId(),
          email: 'other@clinic.lt',
          role: UserRole.VETERINARIAN,
        }),
      );

      await expect(
        service.acceptInvitation(new Types.ObjectId().toString(), token),
      ).rejects.toThrow(ClinicTeamService.WRONG_ACCOUNT_MESSAGE);
    });

    it('joins the clinic with the invited role', async () => {
      const invitation = validInvitation({
        role: ClinicMemberRole.VETERINARIAN,
      });
      const userId = new Types.ObjectId();
      const profileId = new Types.ObjectId();
      invitationModel.findOne.mockReturnValue(execOf(invitation));
      userModel.findById.mockReturnValue(
        execOf({
          _id: userId,
          email: 'new@clinic.lt',
          role: UserRole.VETERINARIAN,
        }),
      );
      profileModel.findOne.mockReturnValue(execOf({ _id: profileId }));
      invitationModel.findOneAndUpdate.mockReturnValue(execOf(invitation));
      membershipModel.updateOne.mockReturnValue(execOf({}));

      const clinic = await service.acceptInvitation(userId.toString(), token);

      expect(membershipModel.updateOne).toHaveBeenCalledWith(
        { veterinarianProfileId: profileId, clinicId },
        {
          $set: {
            status: ClinicMembershipStatus.ACTIVE,
            role: ClinicMemberRole.VETERINARIAN,
          },
        },
        { upsert: true },
      );
      expect(clinic).toMatchObject({
        name: 'Paws Clinic',
        myRole: ClinicMemberRole.VETERINARIAN,
      });
    });

    it('rejects a link that was already used in a race', async () => {
      invitationModel.findOne.mockReturnValue(execOf(validInvitation()));
      userModel.findById.mockReturnValue(
        execOf({
          _id: new Types.ObjectId(),
          email: 'new@clinic.lt',
          role: UserRole.RECEPTIONIST,
        }),
      );
      profileModel.findOne.mockReturnValue(
        execOf({ _id: new Types.ObjectId() }),
      );
      invitationModel.findOneAndUpdate.mockReturnValue(execOf(null));

      await expect(
        service.acceptInvitation(new Types.ObjectId().toString(), token),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(membershipModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('registerWithInvitation', () => {
    it('creates an approved receptionist without a licence', async () => {
      const invitation = validInvitation();
      const user = { _id: new Types.ObjectId() };
      invitationModel.findOne.mockReturnValue(execOf(invitation));
      usersService.create.mockResolvedValue(user as never);
      veterinariansService.createProfile.mockResolvedValue({
        _id: new Types.ObjectId(),
      } as never);
      invitationModel.findOneAndUpdate.mockReturnValue(execOf(invitation));
      membershipModel.updateOne.mockReturnValue(execOf({}));
      authService.issueAuthPayload.mockResolvedValue({
        accessToken: 't',
      } as never);

      await service.registerWithInvitation({
        token,
        password: 'password123',
        firstName: 'Rita',
        lastName: 'Desk',
      });

      expect(usersService.create).toHaveBeenCalledWith({
        email: 'new@clinic.lt',
        password: 'password123',
        role: UserRole.RECEPTIONIST,
        approvalStatus: AccountApprovalStatus.APPROVED,
      });
      expect(authService.issueAuthPayload).toHaveBeenCalledWith(user);
    });

    it('requires a licence and platform approval for veterinarians', async () => {
      invitationModel.findOne.mockReturnValue(
        execOf(validInvitation({ role: ClinicMemberRole.VETERINARIAN })),
      );

      await expect(
        service.registerWithInvitation({
          token,
          password: 'password123',
          firstName: 'Vet',
          lastName: 'Nolicence',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('rolls back the account if joining fails', async () => {
      const invitation = validInvitation({
        role: ClinicMemberRole.VETERINARIAN,
      });
      const user = { _id: new Types.ObjectId() };
      invitationModel.findOne.mockReturnValue(execOf(invitation));
      usersService.create.mockResolvedValue(user as never);
      veterinariansService.createProfile.mockResolvedValue({
        _id: new Types.ObjectId(),
      } as never);
      invitationModel.findOneAndUpdate.mockReturnValue(execOf(null));

      await expect(
        service.registerWithInvitation({
          token,
          password: 'password123',
          firstName: 'Vet',
          lastName: 'Person',
          licenseNumber: 'VET-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalStatus: AccountApprovalStatus.PENDING,
        }),
      );
      expect(usersService.deleteById).toHaveBeenCalledWith(user._id.toString());
    });
  });
});
