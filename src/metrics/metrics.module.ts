import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';
import { MetricsAuthMiddleware } from './metrics.middleware';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'starpass_',
        },
      },
    }),
  ],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MetricsAuthMiddleware)
      .forRoutes('metrics');
  }
}
