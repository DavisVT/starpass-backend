import { Field, ObjectType, Float } from '@nestjs/graphql';

@ObjectType()
export class Creator {
  @Field()
  id: string;

  @Field()
  stellarAddress: string;

  @Field({ nullable: true })
  email?: string;

  @Field()
  displayName: string;

  @Field({ nullable: true })
  bio?: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field(() => Float)
  totalEarned: number;

  @Field()
  registeredAt: Date;

  @Field()
  verified: boolean;

  @Field({ nullable: true })
  verifiedAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
