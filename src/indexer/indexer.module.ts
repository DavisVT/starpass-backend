import { Module } from '@nestjs/common';
import { IndexerService } from './indexer.service';
import { IndexerController } from './indexer.controller';
import { StellarModule } from '../stellar/stellar.module';
import { TiersModule } from '../tiers/tiers.module';
import { PassesModule } from '../passes/passes.module';

@Module({
  imports: [StellarModule, TiersModule, PassesModule],
  controllers: [IndexerController],
  providers: [IndexerService],
  exports: [IndexerService],
})
export class IndexerModule {}
