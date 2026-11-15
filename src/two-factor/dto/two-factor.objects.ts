import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsString, Length, MaxLength, MinLength } from 'class-validator';

@ObjectType('TwoFactorSetup')
export class TwoFactorSetupObject {
  @Field({ description: 'Base32 key to type into an authenticator app' })
  secret!: string;

  @Field({ description: 'otpauth:// link that authenticator apps can open' })
  otpauthUrl!: string;
}

@ObjectType('TwoFactorRecoveryCodes')
export class TwoFactorRecoveryCodesObject {
  @Field(() => [String], {
    description: 'One-time recovery codes. Shown once; only hashes are stored.',
  })
  recoveryCodes!: string[];
}

@InputType()
export class VerifyTwoFactorLoginInput {
  @Field()
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  twoFactorToken!: string;

  /** 6-digit code from the app, or a recovery code (xxxxx-xxxxx). */
  @Field()
  @IsString()
  @Length(6, 20)
  code!: string;
}
