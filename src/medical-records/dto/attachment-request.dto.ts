import { IsMongoId } from 'class-validator';

/** Multipart form fields sent with a file. */
export class UploadAttachmentBody {
  /** The clinic the user is working for; it becomes the file's owner clinic. */
  @IsMongoId()
  clinicId!: string;
}

export class AttachmentClinicQuery {
  @IsMongoId()
  clinicId!: string;
}
