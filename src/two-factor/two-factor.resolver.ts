import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AuthPayload } from '../auth/dto/auth-payload.object';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RATE_LIMITS } from '../common/rate-limit/rate-limit.rules';
import type { UserDocument } from '../users/schemas/user.schema';
import {
  TwoFactorRecoveryCodesObject,
  TwoFactorSetupObject,
  VerifyTwoFactorLoginInput,
} from './dto/two-factor.objects';
import { TwoFactorService } from './two-factor.service';

@Resolver()
export class TwoFactorResolver {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Mutation(() => TwoFactorSetupObject, {
    name: 'startTwoFactorSetup',
    description: 'Creates a new authenticator key (not active until confirmed)',
  })
  @UseGuards(GqlAuthGuard)
  startTwoFactorSetup(
    @CurrentUser() user: UserDocument,
  ): Promise<TwoFactorSetupObject> {
    return this.twoFactorService.startSetup(user._id.toString());
  }

  @Mutation(() => TwoFactorRecoveryCodesObject, {
    name: 'confirmTwoFactorSetup',
    description: 'Turns on two-factor sign-in after checking a first code',
  })
  @UseGuards(GqlAuthGuard)
  @RateLimit(RATE_LIMITS.twoFactorCode)
  confirmTwoFactorSetup(
    @CurrentUser() user: UserDocument,
    @Args('code') code: string,
  ): Promise<TwoFactorRecoveryCodesObject> {
    return this.twoFactorService.confirmSetup(user._id.toString(), code);
  }

  @Mutation(() => Boolean, {
    name: 'disableTwoFactor',
    description:
      'Turns off two-factor sign-in (needs a current or recovery code)',
  })
  @UseGuards(GqlAuthGuard)
  @RateLimit(RATE_LIMITS.twoFactorCode)
  disableTwoFactor(
    @CurrentUser() user: UserDocument,
    @Args('code') code: string,
  ): Promise<boolean> {
    return this.twoFactorService.disable(user._id.toString(), code);
  }

  @Mutation(() => AuthPayload, {
    name: 'verifyTwoFactorLogin',
    description: 'Second sign-in step: authenticator or recovery code',
  })
  @RateLimit(RATE_LIMITS.twoFactorLogin)
  verifyTwoFactorLogin(
    @Args('input') input: VerifyTwoFactorLoginInput,
  ): Promise<AuthPayload> {
    return this.twoFactorService.verifyLogin(input.twoFactorToken, input.code);
  }
}
