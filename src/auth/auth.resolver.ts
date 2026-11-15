import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RATE_LIMITS } from '../common/rate-limit/rate-limit.rules';
import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { mapUserDocumentToObject } from '../users/users.mapper';
import type { UserDocument } from '../users/schemas/user.schema';
import { UserObject } from '../users/dto/user.object';
import { AuthPayload } from './dto/auth-payload.object';
import { LoginInput } from './dto/login.input';
import { RegisterVeterinarianInput } from './dto/register-veterinarian.input';
import { AuthService } from './auth.service';
import { GqlAuthGuard } from './guards/gql-auth.guard';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayload)
  @RateLimit(RATE_LIMITS.login)
  async login(@Args('input') input: LoginInput): Promise<AuthPayload> {
    return this.authService.login(input.email, input.password);
  }

  @Mutation(() => AuthPayload)
  @RateLimit(RATE_LIMITS.register)
  async registerVeterinarian(
    @Args('input') input: RegisterVeterinarianInput,
  ): Promise<AuthPayload> {
    return this.authService.registerVeterinarian(input);
  }

  @Query(() => UserObject, { name: 'me' })
  @UseGuards(GqlAuthGuard)
  me(@CurrentUser() user: UserDocument): UserObject {
    return mapUserDocumentToObject(user);
  }
}
