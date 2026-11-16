import { Field, ID, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

@InputType()
export class MicrochipSearchInput {
  @Field(() => ID, { description: 'Clinic the search is made for' })
  @IsMongoId()
  clinicId!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Transform(trimString)
  microchip!: string;
}

@InputType()
export class NotifyOwnerAboutFoundPetInput extends MicrochipSearchInput {
  @Field(() => ID)
  @IsMongoId()
  petId!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(trimString)
  message?: string;
}
