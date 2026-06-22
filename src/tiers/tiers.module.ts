import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TiersController } from './tiers.controller';
import { TiersService } from './tiers.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../common/prisma.module';

@Module({
  imports: [AuthModule, ConfigModule, PrismaModule],
  controllers: [TiersController],
  providers: [TiersService],
  exports: [TiersService],
})
export class TiersModule {}
