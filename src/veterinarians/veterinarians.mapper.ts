import { VeterinarianProfileObject } from './dto/veterinarian-profile.object';
import { VeterinarianProfileDocument } from './schemas/veterinarian-profile.schema';

export function mapVeterinarianProfileToObject(
  profile: VeterinarianProfileDocument,
): VeterinarianProfileObject {
  return {
    id: profile._id.toString(),
    userId: profile.userId.toString(),
    firstName: profile.firstName,
    lastName: profile.lastName,
    licenseNumber: profile.licenseNumber,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}
