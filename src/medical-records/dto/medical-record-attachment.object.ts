import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
} from '@nestjs/graphql';

@ObjectType('VetMedicalRecordAttachment', {
  description: 'A file attached to a medical record (lab result, X-ray…)',
})
export class VetMedicalRecordAttachmentObject {
  @Field(() => ID)
  id!: string;

  @Field()
  fileName!: string;

  @Field({
    description: 'application/pdf, image/jpeg, image/png or image/webp',
  })
  contentType!: string;

  @Field(() => Int, { description: 'Size in bytes' })
  size!: number;

  @Field(() => ID, {
    nullable: true,
    description: 'Clinic that attached the file; only it can remove the file',
  })
  clinicId?: string | null;

  @Field(() => String, { nullable: true })
  clinicName?: string | null;

  @Field(() => String, { nullable: true })
  uploadedByName?: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;
}
