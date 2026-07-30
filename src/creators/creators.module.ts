import { Module } from '@nestjs/common';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { PrismaModule } from '../common/prisma.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CreatorSchedulerService } from './scheduler.service';
import { TiersModule } from '../tiers/tiers.module';

@Module({
  imports: [PrismaModule, WebhooksModule, AuthModule, NotificationsModule, TiersModule],
  controllers: [CreatorsController],
  providers: [CreatorsService, CreatorSchedulerService],
  exports: [CreatorsService],
})
export class CreatorsModule {}
