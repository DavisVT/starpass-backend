import { Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { PrismaModule } from '../common/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
