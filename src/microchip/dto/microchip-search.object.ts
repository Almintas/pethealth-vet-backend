import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('MicrochipMatch')
export class MicrochipMatchObject {
  @Field(() => ID, {
    description:
      'Pass to notifyOwnerAboutFoundPet; open as a patient only if hasAccess',
  })
  petId!: string;

  @Field()
  name!: string;

  @Field()
  species!: string;

  @Field(() => String, { nullable: true })
  breed?: string | null;

  @Field({
    description:
      'True when the clinic already has the owner’s consent for this pet',
  })
  hasAccess!: boolean;
}

@ObjectType('MicrochipSearchResult')
export class MicrochipSearchResultObject {
  @Field({ description: 'The chip number as searched (separators removed)' })
  microchip!: string;

  @Field(() => [MicrochipMatchObject])
  matches!: MicrochipMatchObject[];
}
