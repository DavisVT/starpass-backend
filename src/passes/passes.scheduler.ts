import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PassesService } from './passes.service';

@Injectable()
export class PassesScheduler {
  private readonly logger = new Logger(PassesScheduler.name);

  constructor(private passesService: PassesService) {}

  @Cron('0 * * * *')
  async deactivateExpiredPasses() {
    const count = await this.passesService.deactivateExpiredPasses();
    this.logger.log(`Deactivated ${count} expired pass(es)`);
  }

  @Cron('0 * * * *')
  async processAutoRenewals() {
    const count = await this.passesService.processExpiredPassesForAutoRenew();
    this.logger.log(`Processed ${count} pass(es) for auto-renewal`);
  }
}
