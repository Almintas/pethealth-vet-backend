import { UserObject } from './dto/user.object';
import { UserDocument } from './schemas/user.schema';

export function mapUserDocumentToObject(user: UserDocument): UserObject {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
