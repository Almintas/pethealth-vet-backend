import { registerEnumType } from '@nestjs/graphql';

export enum AuditAction {
  VIEWED = 'VIEWED',
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  CANCELLED = 'CANCELLED',
  DELETED = 'DELETED',
  /** A clinic found the pet by its microchip. */
  MICROCHIP_LOOKUP = 'MICROCHIP_LOOKUP',
  /** A clinic asked PetHealth to email the owner that the pet is with them. */
  OWNER_NOTIFIED = 'OWNER_NOTIFIED',
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  ACCESS_REVOKED = 'ACCESS_REVOKED',
}

export enum AuditEntityType {
  PATIENT = 'PATIENT',
  MEDICAL_RECORD = 'MEDICAL_RECORD',
  MEDICATION = 'MEDICATION',
  VACCINATION = 'VACCINATION',
  APPOINTMENT = 'APPOINTMENT',
  /** A file attached to a medical record. */
  ATTACHMENT = 'ATTACHMENT',
  /** A reminder the clinic set for the owner. */
  REMINDER = 'REMINDER',
}

export enum AuditActorType {
  CLINIC_USER = 'CLINIC_USER',
  OWNER = 'OWNER',
}

registerEnumType(AuditAction, {
  name: 'AuditAction',
  description: 'What happened to the pet data',
});
registerEnumType(AuditEntityType, {
  name: 'AuditEntityType',
  description: 'Which kind of pet data the event is about',
});
registerEnumType(AuditActorType, {
  name: 'AuditActorType',
  description: 'Who performed the action',
});
