import { Field, ObjectType, Int } from '@nestjs/graphql';
import { Creator } from './creator.model';
import { Tier } from './tier.model';
import { Pass } from './pass.model';

@ObjectType()
export class PaginatedCreators {
  @Field(() => [Creator])
  data: Creator[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;
}

@ObjectType()
export class PaginatedTiers {
  @Field(() => [Tier])
  data: Tier[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;
}

@ObjectType()
export class PaginatedPasses {
  @Field(() => [Pass])
  data: Pass[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;
}
