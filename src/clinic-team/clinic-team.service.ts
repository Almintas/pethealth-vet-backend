import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Model, Types, isValidObjectId } from 'mongoose';
import { AuthService } from '../auth/auth.service';
import { AuthPayload } from '../auth/dto/auth-payload.object';
import { AccountApprovalStatus } from '../common/enums/account-approval-status.enum';
import {
  ClinicMemberRole,
  effectiveClinicMemberRole,
} from '../common/enums/clinic-member-role.enum';
import { ClinicMembershipStatus } from '../common/enums/clinic-membership-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { ClinicObject } from '../clinics/dto/clinic.object';
import { mapClinicToObject } from '../clinics/clinics.mapper';
import {
  ClinicMembership,
  ClinicMembershipDocument,
} from '../clinics/schemas/clinic-membership.schema';
import { Clinic, ClinicDocument } from '../clinics/schemas/clinic.schema';
import { buildEmail } from '../mail/email-layout';
import { MailService } from '../mail/mail.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import {
  VeterinarianProfile,
  VeterinarianProfileDocument,
} from '../veterinarians/schemas/veterinarian-profile.schema';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import {
  CreateClinicInvitationInput,
  RegisterWithInvitationInput,
} from './dto/clinic-team.inputs';
import {
  ClinicInvitationObject,
  ClinicInvitationPreviewObject,
  ClinicInvitationState,
  ClinicMemberObject,
  CreateClinicInvitationPayload,
} from './dto/clinic-team.objects';
import {
  ClinicInvitation,
  ClinicInvitationDocument,
} from './schemas/clinic-invitation.schema';

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ROLE_LABELS: Record<ClinicMemberRole, string> = {
  [ClinicMemberRole.ADMIN]: 'clinic administrator',
  [ClinicMemberRole.VETERINARIAN]: 'veterinarian',
  [ClinicMemberRole.RECEPTIONIST]: 'receptionist',
};

/**
 * Clinic team management: clinic admins invite colleagues by email, see the
 * team and remove members. Invitees accept with an existing account or
 * create one from the invitation.
 *
 * Approval: receptionists invited by an approved clinic admin are approved
 * immediately (no licence needed). Veterinarians still need a licence number
 * and PetHealth approval before they can work with patients.
 */
@Injectable()
export class ClinicTeamService {
  static readonly INVALID_INVITATION_MESSAGE =
    'This invitation link is invalid or has expired. Ask the clinic to send a new one.';
  static readonly WRONG_ACCOUNT_MESSAGE =
    'This invitation was sent to a different email address. Sign in with that email to accept it.';

  private readonly logger = new Logger(ClinicTeamService.name);

  constructor(
    @InjectModel(ClinicInvitation.name)
    private readonly invitationModel: Model<ClinicInvitationDocument>,
    @InjectModel(ClinicMembership.name)
    private readonly membershipModel: Model<ClinicMembershipDocument>,
    @InjectModel(Clinic.name)
    private readonly clinicModel: Model<ClinicDocument>,
    @InjectModel(VeterinarianProfile.name)
    private readonly profileModel: Model<VeterinarianProfileDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly usersService: UsersService,
    private readonly veterinariansService: VeterinariansService,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async listMembers(
    userId: string,
    clinicId: string,
  ): Promise<ClinicMemberObject[]> {
    await this.findActiveMembershipForUser(userId, clinicId);

    const memberships = await this.membershipModel
      .find({
        clinicId: new Types.ObjectId(clinicId),
        status: ClinicMembershipStatus.ACTIVE,
      })
      .sort({ createdAt: 1 })
      .exec();
    const profiles = await this.profileModel
      .find({
        _id: { $in: memberships.map((m) => m.veterinarianProfileId) },
      })
      .exec();
    const users = await this.userModel
      .find({ _id: { $in: profiles.map((profile) => profile.userId) } })
      .exec();
    const profileById = new Map(profiles.map((p) => [p._id.toString(), p]));
    const userById = new Map(users.map((u) => [u._id.toString(), u]));

    return memberships.flatMap((membership) => {
      const profile = profileById.get(
        membership.veterinarianProfileId.toString(),
      );
      if (!profile) {
        return [];
      }
      const user = userById.get(profile.userId.toString());
      return [
        {
          membershipId: membership._id.toString(),
          userId: profile.userId.toString(),
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: user?.email ?? null,
          role: effectiveClinicMemberRole(membership.role),
          approvalStatus: user?.approvalStatus ?? AccountApprovalStatus.PENDING,
          joinedAt: membership.createdAt,
          isMe: profile.userId.toString() === userId,
        },
      ];
    });
  }

  async listInvitations(
    userId: string,
    clinicId: string,
  ): Promise<ClinicInvitationObject[]> {
    await this.assertClinicAdmin(userId, clinicId);
    const invitations = await this.invitationModel
      .find({
        clinicId: new Types.ObjectId(clinicId),
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 })
      .exec();
    return invitations.map((invitation) => this.toInvitationObject(invitation));
  }

  async inviteMember(
    userId: string,
    input: CreateClinicInvitationInput,
  ): Promise<CreateClinicInvitationPayload> {
    await this.assertClinicAdmin(userId, input.clinicId);
    const clinicObjectId = new Types.ObjectId(input.clinicId);
    const email = input.email.trim().toLowerCase();

    if (await this.isActiveMemberByEmail(email, clinicObjectId)) {
      throw new ConflictException(
        'This person is already a member of the clinic.',
      );
    }

    // One open invitation per email and clinic: a new one replaces the old.
    await this.invitationModel
      .updateMany(
        { clinicId: clinicObjectId, email, acceptedAt: null, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();

    const token = randomBytes(32).toString('base64url');
    const invitation = await this.invitationModel.create({
      clinicId: clinicObjectId,
      email,
      role: input.role,
      tokenHash: this.hashToken(token),
      invitedByUserId: new Types.ObjectId(userId),
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      acceptedAt: null,
      revokedAt: null,
    });

    const clinic = await this.clinicModel.findById(clinicObjectId).exec();
    const inviter = await this.profileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    const inviteUrl = `${this.frontendUrl()}/invite?token=${encodeURIComponent(token)}`;
    const emailSent = await this.sendInvitationEmail({
      to: email,
      clinicName: clinic?.name ?? 'A clinic',
      inviterName: inviter
        ? `${inviter.firstName} ${inviter.lastName}`.trim()
        : null,
      role: input.role,
      inviteUrl,
    });

    return {
      invitation: this.toInvitationObject(invitation),
      inviteUrl,
      emailSent,
    };
  }

  async revokeInvitation(
    userId: string,
    invitationId: string,
  ): Promise<boolean> {
    if (!isValidObjectId(invitationId)) {
      throw new NotFoundException('Invitation not found');
    }
    const invitation = await this.invitationModel.findById(invitationId).exec();
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    await this.assertClinicAdmin(userId, invitation.clinicId.toString());
    if (!invitation.acceptedAt && !invitation.revokedAt) {
      invitation.revokedAt = new Date();
      await invitation.save();
    }
    return true;
  }

  async removeMember(
    userId: string,
    clinicId: string,
    membershipId: string,
  ): Promise<boolean> {
    await this.assertClinicAdmin(userId, clinicId);
    if (!isValidObjectId(membershipId)) {
      throw new NotFoundException('Team member not found');
    }
    const membership = await this.membershipModel
      .findOne({
        _id: new Types.ObjectId(membershipId),
        clinicId: new Types.ObjectId(clinicId),
        status: ClinicMembershipStatus.ACTIVE,
      })
      .exec();
    if (!membership) {
      throw new NotFoundException('Team member not found');
    }

    if (effectiveClinicMemberRole(membership.role) === ClinicMemberRole.ADMIN) {
      const activeMemberships = await this.membershipModel
        .find({
          clinicId: new Types.ObjectId(clinicId),
          status: ClinicMembershipStatus.ACTIVE,
        })
        .exec();
      const adminCount = activeMemberships.filter(
        (m) => effectiveClinicMemberRole(m.role) === ClinicMemberRole.ADMIN,
      ).length;
      if (adminCount <= 1) {
        throw new ForbiddenException(
          'A clinic needs at least one administrator. Invite another administrator first.',
        );
      }
    }

    membership.status = ClinicMembershipStatus.INACTIVE;
    await membership.save();
    return true;
  }

  async previewInvitation(
    token: string,
  ): Promise<ClinicInvitationPreviewObject> {
    const invitation = await this.findInvitationByToken(token);
    if (!invitation) {
      return { state: ClinicInvitationState.EXPIRED, accountExists: false };
    }
    const clinic = await this.clinicModel.findById(invitation.clinicId).exec();
    const accountExists = Boolean(
      await this.userModel.exists({ email: invitation.email }).exec(),
    );
    return {
      state: this.stateOf(invitation),
      clinicName: clinic?.name ?? null,
      email: invitation.email,
      role: invitation.role,
      accountExists,
    };
  }

  async acceptInvitation(userId: string, token: string): Promise<ClinicObject> {
    const invitation = await this.requireValidInvitation(token);
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('Account not found');
    }
    if (user.email !== invitation.email) {
      throw new ForbiddenException(ClinicTeamService.WRONG_ACCOUNT_MESSAGE);
    }
    if (user.role === UserRole.PLATFORM_ADMIN) {
      throw new ForbiddenException(
        'Platform admin accounts cannot join clinics.',
      );
    }
    const profile = await this.profileModel
      .findOne({ userId: user._id })
      .exec();
    if (!profile) {
      throw new BadRequestException('A profile is required to join a clinic.');
    }
    return this.joinClinic(invitation, profile._id);
  }

  async registerWithInvitation(
    input: RegisterWithInvitationInput,
  ): Promise<AuthPayload> {
    const invitation = await this.requireValidInvitation(input.token);
    const isReceptionist = invitation.role === ClinicMemberRole.RECEPTIONIST;
    const licenseNumber = input.licenseNumber?.trim();
    if (!isReceptionist && !licenseNumber) {
      throw new BadRequestException(
        'A licence number is required to join as a veterinarian.',
      );
    }

    let user: UserDocument | undefined;
    try {
      user = await this.usersService.create({
        email: invitation.email,
        password: input.password,
        role: isReceptionist ? UserRole.RECEPTIONIST : UserRole.VETERINARIAN,
        approvalStatus: isReceptionist
          ? AccountApprovalStatus.APPROVED
          : AccountApprovalStatus.PENDING,
      });
      const profile = await this.veterinariansService.createProfile({
        userId: user._id.toString(),
        firstName: input.firstName,
        lastName: input.lastName,
        licenseNumber: isReceptionist ? undefined : licenseNumber,
      });
      await this.joinClinic(invitation, profile._id);
    } catch (error) {
      if (user) {
        await this.usersService.deleteById(user._id.toString());
      }
      throw error;
    }

    return this.authService.issueAuthPayload(user);
  }

  private async joinClinic(
    invitation: ClinicInvitationDocument,
    profileId: Types.ObjectId,
  ): Promise<ClinicObject> {
    const clinic = await this.clinicModel.findById(invitation.clinicId).exec();
    if (!clinic) {
      throw new NotFoundException(ClinicTeamService.INVALID_INVITATION_MESSAGE);
    }

    // Claim the invitation atomically so a link can't be used twice.
    const claimed = await this.invitationModel
      .findOneAndUpdate(
        { _id: invitation._id, acceptedAt: null, revokedAt: null },
        { $set: { acceptedAt: new Date() } },
        { new: true },
      )
      .exec();
    if (!claimed) {
      throw new BadRequestException(
        ClinicTeamService.INVALID_INVITATION_MESSAGE,
      );
    }

    await this.membershipModel
      .updateOne(
        { veterinarianProfileId: profileId, clinicId: invitation.clinicId },
        {
          $set: {
            status: ClinicMembershipStatus.ACTIVE,
            role: invitation.role,
          },
        },
        { upsert: true },
      )
      .exec();

    return { ...mapClinicToObject(clinic), myRole: invitation.role };
  }

  private async sendInvitationEmail(params: {
    to: string;
    clinicName: string;
    inviterName: string | null;
    role: ClinicMemberRole;
    inviteUrl: string;
  }): Promise<boolean> {
    if (!this.mailService.isConfigured()) {
      if (this.configService.get<string>('NODE_ENV') !== 'production') {
        this.logger.log(
          `Email is not configured; invitation link for ${params.to}: ${params.inviteUrl}`,
        );
      }
      return false;
    }
    const who = params.inviterName
      ? `${params.inviterName} invited you`
      : 'You have been invited';
    const { html, text } = buildEmail({
      title: `Join ${params.clinicName} on PetHealth Vet`,
      paragraphs: [
        `${who} to join ${params.clinicName} as a ${ROLE_LABELS[params.role]}.`,
        'Open the link to accept. If you do not have a PetHealth Vet account yet, you can create one there. The link is valid for 7 days.',
        'If you did not expect this invitation, you can ignore this email.',
      ],
      ctaLabel: 'Accept invitation',
      ctaUrl: params.inviteUrl,
    });
    const result = await this.mailService.send({
      to: params.to,
      subject: `Invitation to join ${params.clinicName}`,
      html,
      text,
    });
    return result.ok;
  }

  private async findActiveMembershipForUser(
    userId: string,
    clinicId: string,
  ): Promise<ClinicMembershipDocument> {
    if (!isValidObjectId(clinicId)) {
      throw new ForbiddenException('No active membership for this clinic');
    }
    const profile = await this.profileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    const membership = profile
      ? await this.membershipModel
          .findOne({
            veterinarianProfileId: profile._id,
            clinicId: new Types.ObjectId(clinicId),
            status: ClinicMembershipStatus.ACTIVE,
          })
          .exec()
      : null;
    if (!membership) {
      throw new ForbiddenException('No active membership for this clinic');
    }
    return membership;
  }

  private async assertClinicAdmin(
    userId: string,
    clinicId: string,
  ): Promise<void> {
    const membership = await this.findActiveMembershipForUser(userId, clinicId);
    if (effectiveClinicMemberRole(membership.role) !== ClinicMemberRole.ADMIN) {
      throw new ForbiddenException(
        'Only clinic administrators can manage the team.',
      );
    }
  }

  private async isActiveMemberByEmail(
    email: string,
    clinicId: Types.ObjectId,
  ): Promise<boolean> {
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      return false;
    }
    const profile = await this.profileModel
      .findOne({ userId: user._id })
      .exec();
    if (!profile) {
      return false;
    }
    return Boolean(
      await this.membershipModel
        .exists({
          veterinarianProfileId: profile._id,
          clinicId,
          status: ClinicMembershipStatus.ACTIVE,
        })
        .exec(),
    );
  }

  private async findInvitationByToken(
    token: string,
  ): Promise<ClinicInvitationDocument | null> {
    const trimmed = token?.trim();
    if (!trimmed) {
      return null;
    }
    return this.invitationModel
      .findOne({ tokenHash: this.hashToken(trimmed) })
      .exec();
  }

  private async requireValidInvitation(
    token: string,
  ): Promise<ClinicInvitationDocument> {
    const invitation = await this.findInvitationByToken(token);
    if (
      !invitation ||
      this.stateOf(invitation) !== ClinicInvitationState.VALID
    ) {
      throw new BadRequestException(
        ClinicTeamService.INVALID_INVITATION_MESSAGE,
      );
    }
    return invitation;
  }

  private stateOf(invitation: ClinicInvitationDocument): ClinicInvitationState {
    if (invitation.acceptedAt) {
      return ClinicInvitationState.USED;
    }
    if (invitation.revokedAt) {
      return ClinicInvitationState.REVOKED;
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      return ClinicInvitationState.EXPIRED;
    }
    return ClinicInvitationState.VALID;
  }

  private toInvitationObject(
    invitation: ClinicInvitationDocument,
  ): ClinicInvitationObject {
    return {
      id: invitation._id.toString(),
      clinicId: invitation.clinicId.toString(),
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  private frontendUrl(): string {
    return (
      this.configService.get<string>('VET_FRONTEND_URL') ??
      'http://localhost:5174'
    ).replace(/\/+$/, '');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
