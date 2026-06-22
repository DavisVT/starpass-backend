import { Module } from '@nestjs/common';
import { FansController } from './fans.controller';
import { FansService } from './fans.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../common/prisma.module';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [FansController],
  providers: [FansService],
  exports: [FansService],
})
export class FansModule {}
