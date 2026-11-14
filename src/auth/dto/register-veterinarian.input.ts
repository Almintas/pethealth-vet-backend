import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsString, MinLength } from 'class-validator';

@InputType()
export class RegisterVeterinarianInput {
  @Field()
  @IsEmail()
  email!: string;

  @Field()
  @IsString()
  @MinLength(8)
  password!: string;

  @Field()
  @IsString()
  @MinLength(1)
  firstName!: string;

  @Field()
  @IsString()
  @MinLength(1)
  lastName!: string;

  /** Required so PetHealth can verify the vet against the official register. */
  @Field()
  @IsString()
  @MinLength(1)
  licenseNumber!: string;
}
