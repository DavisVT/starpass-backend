import { Module, forwardRef } from '@nestjs/common';
import { PassesController } from './passes.controller';
import { PassesService } from './passes.service';
import { PassesScheduler } from './passes.scheduler';
import { AuthModule } from '../auth/auth.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TiersModule } from '../tiers/tiers.module';
import { AdminModule } from '../admin/admin.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [AuthModule, WebhooksModule, NotificationsModule, forwardRef(() => TiersModule), AdminModule, MetricsModule],
  controllers: [PassesController],
  providers: [PassesService, PassesScheduler],
  exports: [PassesService],
})
export class PassesModule {}
