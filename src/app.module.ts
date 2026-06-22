import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpLoggerMiddleware as RequestLoggerMiddleware } from './common/http-logger.middleware';
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
import { MetricsModule } from './metrics/metrics.module';
import { RedisCacheModule } from './common/cache/cache.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisCacheModule,
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
    MetricsModule,
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

