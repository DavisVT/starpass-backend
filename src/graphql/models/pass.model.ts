import { Field, ObjectType, Int } from '@nestjs/graphql';
import { Tier } from './tier.model';
import { Creator } from './creator.model';
import { Fan } from './fan.model';

@ObjectType()
export class Pass {
  @Field()
  id: string;

  @Field(() => Int)
  onChainId: number;

  @Field(() => Tier, { nullable: true })
  tier?: Tier;

  @Field(() => Creator, { nullable: true })
  creator?: Creator;

  @Field(() => Fan, { nullable: true })
  fan?: Fan;

  @Field()
  purchasedAt: Date;

  @Field()
  expiresAt: Date;

  @Field({ nullable: true })
  txHash?: string;

  @Field()
  active: boolean;

  @Field()
  createdAt: Date;
}
