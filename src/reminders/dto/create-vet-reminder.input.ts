import { Field, GraphQLISODateTime, ID, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const VET_REMINDER_TYPES = [
  'APPOINTMENT',
  'VACCINATION',
  'MEDICATION',
  'GENERAL',
] as const;

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

@InputType()
export class CreateVetReminderInput {
  @Field(() => ID, { description: 'Clinic setting the reminder' })
  @IsMongoId()
  clinicId!: string;

  @Field(() => ID)
  @IsMongoId()
  petId!: string;

  @Field({ description: 'APPOINTMENT, VACCINATION, MEDICATION or GENERAL' })
  @IsIn(VET_REMINDER_TYPES)
  type!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(trimString)
  title!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(trimString)
  message?: string;

  @Field(() => GraphQLISODateTime)
  @Type(() => Date)
  @IsDate()
  dueAt!: Date;
}
