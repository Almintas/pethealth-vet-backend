import { registerEnumType } from '@nestjs/graphql';

export enum AuditAction {
  VIEWED = 'VIEWED',
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  CANCELLED = 'CANCELLED',
  ACCESS_GRANTED = 'ACCESS_GRANTED',
  ACCESS_REVOKED = 'ACCESS_REVOKED',
}

export enum AuditEntityType {
  PATIENT = 'PATIENT',
  MEDICAL_RECORD = 'MEDICAL_RECORD',
  MEDICATION = 'MEDICATION',
  VACCINATION = 'VACCINATION',
  APPOINTMENT = 'APPOINTMENT',
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
