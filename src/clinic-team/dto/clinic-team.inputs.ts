import { Field, ID, InputType } from '@nestjs/graphql';
import {
  IsEmail,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ClinicMemberRole } from '../../common/enums/clinic-member-role.enum';

@InputType()
export class CreateClinicInvitationInput {
  @Field(() => ID)
  @IsMongoId()
  clinicId!: string;

  @Field()
  @IsEmail()
  email!: string;

  @Field(() => ClinicMemberRole)
  @IsEnum(ClinicMemberRole)
  role!: ClinicMemberRole;
}

@InputType()
export class RegisterWithInvitationInput {
  @Field()
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;

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

  /** Required when invited as a veterinarian or clinic admin. */
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  licenseNumber?: string;
}
