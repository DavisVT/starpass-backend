import { Field, ObjectType, Int, Float } from '@nestjs/graphql';
import { Creator } from './creator.model';

@ObjectType()
export class Tier {
  @Field()
  id: string;

  @Field(() => Int)
  onChainId: number;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  priceUsdc: number;

  @Field(() => Int)
  durationDays: number;

  @Field(() => Int)
  maxSupply: number;

  @Field(() => Int)
  minted: number;

  @Field()
  active: boolean;

  @Field(() => Creator, { nullable: true })
  creator?: Creator;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
