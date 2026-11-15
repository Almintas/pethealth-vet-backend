import { Field, ID, ObjectType } from '@nestjs/graphql';
import {
  AuditAction,
  AuditActorType,
  AuditEntityType,
} from '../../audit/enums/audit.enums';

@ObjectType('InternalAuditEvent')
export class InternalAuditEventObject {
  @Field(() => ID)
  id!: string;

  @Field(() => AuditAction)
  action!: AuditAction;

  @Field(() => AuditEntityType)
  entityType!: AuditEntityType;

  @Field(() => AuditActorType)
  actorType!: AuditActorType;

  @Field(() => String, { nullable: true })
  actorName?: string | null;

  @Field(() => ID, { nullable: true })
  clinicId?: string | null;

  @Field(() => String, { nullable: true })
  clinicName?: string | null;

  @Field(() => String, { nullable: true })
  summary?: string | null;

  @Field()
  createdAt!: Date;
}
