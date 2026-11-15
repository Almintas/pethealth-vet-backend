import { ClinicPetAccessObject } from './dto/clinic-pet-access.object';
import { ClinicPetAccessDocument } from './schemas/clinic-pet-access.schema';

export function mapClinicPetAccessToObject(
  access: ClinicPetAccessDocument,
): ClinicPetAccessObject {
  return {
    id: access._id.toString(),
    petId: access.petId,
    clinicId: access.clinicId.toString(),
    status: access.status,
    grantedAt: access.grantedAt,
    revokedAt: access.revokedAt ?? null,
    grantedBy: access.grantedBy?.toString() ?? null,
    createdAt: access.createdAt,
    updatedAt: access.updatedAt,
  };
}
