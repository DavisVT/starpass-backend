import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpLoggerMiddleware } from './common/http-logger.middleware';
import { AuthModule } from './auth/auth.module';
import { CreatorsModule } from './creators/creators.module';
import { FansModule } from './fans/fans.module';
import { TiersModule } from './tiers/tiers.module';
import { PassesModule } from './passes/passes.module';
import { IndexerModule } from './indexer/indexer.module';
import { StellarModule } from './stellar/stellar.module';
import { DevModule } from './dev/dev.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'auth-login',
        ttl: 60000, // 1 minute in milliseconds
        limit: 10, // max 10 requests per minute
      },
      {
        name: 'auth-nonce',
        ttl: 60000, // 1 minute in milliseconds
        limit: 20, // max 20 requests per minute
      },
      {
        name: 'default',
        ttl: 60000,
        limit: 100, // default limit for other endpoints
      },
    ]),
    AuthModule,
    CreatorsModule,
    FansModule,
    TiersModule,
    PassesModule,
    IndexerModule,
    StellarModule,
    DevModule,
    WebhooksModule,
    NotificationsModule,
    AdminModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLoggerMiddleware)
      .exclude('health', 'health/(.*)')
      .forRoutes('*');
  }
}

