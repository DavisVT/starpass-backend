import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '../common/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [EmailService, NotificationsService],
  exports: [EmailService, NotificationsService],
})
export class NotificationsModule {}
