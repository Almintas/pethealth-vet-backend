import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

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

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  licenseNumber?: string;
}
