import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserRole } from '../common/enums/user-role.enum';
import { PasswordService } from '../common/services/password.service';
import { User, UserDocument } from './schemas/user.schema';

export interface CreateUserInput {
  email: string;
  password: string;
  role?: UserRole;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly passwordService: PasswordService,
  ) {}

  async create(input: CreateUserInput): Promise<UserDocument> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const existing = await this.userModel.findOne({ email: normalizedEmail });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await this.passwordService.hash(input.password);
    const user = new this.userModel({
      email: normalizedEmail,
      passwordHash,
      role: input.role ?? UserRole.VETERINARIAN,
    });
    return user.save();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash')
      .exec();
  }

  async deleteById(id: string): Promise<void> {
    await this.userModel.findByIdAndDelete(id).exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<UserDocument | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }
    const valid = await this.passwordService.compare(password, user.passwordHash);
    if (!valid) {
      return null;
    }
    return user;
  }
}
