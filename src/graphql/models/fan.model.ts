import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Fan {
  @Field()
  id: string;

  @Field()
  stellarAddress: string;

  @Field({ nullable: true })
  displayName?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
