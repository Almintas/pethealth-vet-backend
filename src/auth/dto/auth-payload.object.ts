import { Field, ObjectType } from '@nestjs/graphql';
import { UserObject } from '../../users/dto/user.object';

@ObjectType()
export class AuthPayload {
  @Field(() => String, {
    nullable: true,
    description:
      'Session token. Null while a two-factor code is still required.',
  })
  accessToken!: string | null;

  @Field(() => UserObject, { nullable: true })
  user!: UserObject | null;

  @Field({ defaultValue: false })
  twoFactorRequired!: boolean;

  @Field(() => String, {
    nullable: true,
    description:
      'Short-lived token for verifyTwoFactorLogin when twoFactorRequired is true',
  })
  twoFactorToken?: string | null;
}
