import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { CreatorsModule } from '../creators/creators.module';
import { TiersModule } from '../tiers/tiers.module';
import { PassesModule } from '../passes/passes.module';
import { FansModule } from '../fans/fans.module';
import { CreatorsResolver } from './resolvers/creators.resolver';
import { TiersResolver } from './resolvers/tiers.resolver';
import { PassesResolver } from './resolvers/passes.resolver';
import { FansResolver } from './resolvers/fans.resolver';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/graphql/schema.gql'),
      playground: process.env.NODE_ENV !== 'production',
      path: '/graphql',
    }),
    CreatorsModule,
    TiersModule,
    PassesModule,
    FansModule,
  ],
  providers: [CreatorsResolver, TiersResolver, PassesResolver, FansResolver],
})
export class GraphqlAppModule {}
