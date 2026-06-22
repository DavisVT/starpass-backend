import { Module } from '@nestjs/common';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { PrismaModule } from '../common/prisma.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CreatorSchedulerService } from './scheduler.service';

@Module({
  imports: [PrismaModule, WebhooksModule, AuthModule, NotificationsModule],
  controllers: [CreatorsController],
  providers: [CreatorsService, CreatorSchedulerService],
  exports: [CreatorsService],
})
export class CreatorsModule {}
