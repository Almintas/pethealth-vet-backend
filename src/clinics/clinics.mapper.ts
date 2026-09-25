import { ClinicObject } from './dto/clinic.object';
import { ClinicDocument } from './schemas/clinic.schema';

export function mapClinicToObject(clinic: ClinicDocument): ClinicObject {
  return {
    id: clinic._id.toString(),
    name: clinic.name,
    email: clinic.email,
    phone: clinic.phone,
    address: clinic.address,
    createdAt: clinic.createdAt,
    updatedAt: clinic.updatedAt,
  };
}
