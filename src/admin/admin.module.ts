import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminConfigController } from './admin-config.controller';
import { AdminConfigService } from './admin-config.service';
import { PrismaModule } from '../common/prisma.module';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [PrismaModule, StellarModule],
  controllers: [AdminController, AdminConfigController],
  providers: [AdminService, AdminConfigService],
  exports: [AdminService, AdminConfigService],
})
export class AdminModule {}
