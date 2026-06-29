import { Module } from '@nestjs/common';
import { StellarService, StellarController } from './stellar.service';

@Module({
  controllers: [StellarController],
  providers: [StellarService],
  exports: [StellarService],
})
export class StellarModule {}
