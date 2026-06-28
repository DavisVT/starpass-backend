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
}
