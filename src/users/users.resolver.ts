import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { mapVeterinarianProfileToObject } from '../veterinarians/veterinarians.mapper';
import { VeterinariansService } from '../veterinarians/veterinarians.service';
import { VeterinarianProfileObject } from '../veterinarians/dto/veterinarian-profile.object';
import { UserObject } from './dto/user.object';

@Resolver(() => UserObject)
export class UsersResolver {
  constructor(private readonly veterinariansService: VeterinariansService) {}

  @ResolveField(() => VeterinarianProfileObject, {
    name: 'veterinarianProfile',
    nullable: true,
  })
  async veterinarianProfile(
    @Parent() user: UserObject,
  ): Promise<VeterinarianProfileObject | null> {
    const profile = await this.veterinariansService.findOptionalByUserId(
      user.id,
    );
    if (!profile) {
      return null;
    }
    return mapVeterinarianProfileToObject(profile);
  }
}
