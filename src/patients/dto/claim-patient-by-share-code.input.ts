import { Field, ID, InputType } from '@nestjs/graphql';
import { IsMongoId, IsString, Length } from 'class-validator';

@InputType()
export class ClaimPatientByShareCodeInput {
  @Field(() => ID)
  @IsMongoId()
  clinicId!: string;

  /** Code shown in the Owner Portal, e.g. "ABCD-2345" (dash optional). */
  @Field()
  @IsString()
  @Length(8, 12)
  code!: string;
}
