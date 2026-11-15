import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class PasswordService {
  async hash(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, BCRYPT_ROUNDS);
  }

  async compare(plainText: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainText, passwordHash);
  }
}
