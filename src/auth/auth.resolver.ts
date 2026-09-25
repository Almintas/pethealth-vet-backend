import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { mapUserDocumentToObject } from '../users/users.mapper';
import type { UserDocument } from '../users/schemas/user.schema';
import { UserObject } from '../users/dto/user.object';
import { AuthPayload } from './dto/auth-payload.object';
import { LoginInput } from './dto/login.input';
import { AuthService } from './auth.service';
import { GqlAuthGuard } from './guards/gql-auth.guard';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayload)
  async login(@Args('input') input: LoginInput): Promise<AuthPayload> {
    return this.authService.login(input.email, input.password);
  }

  @Query(() => UserObject, { name: 'me' })
  @UseGuards(GqlAuthGuard)
  me(@CurrentUser() user: UserDocument): UserObject {
    return mapUserDocumentToObject(user);
  }
}
