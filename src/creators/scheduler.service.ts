import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { CreatorsService } from './creators.service';

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class CreatorSchedulerService implements OnModuleInit, OnModuleDestroy {
  private interval: NodeJS.Timeout | null = null;
  private readonly logger = new Logger(CreatorSchedulerService.name);

  constructor(private creatorsService: CreatorsService) {}

  onModuleInit() {
    // Run immediately then every interval
    this.runOnce().catch((e) => this.logger.error(e));
    this.interval = setInterval(() => this.runOnce().catch((e) => this.logger.error(e)), CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  private async runOnce() {
    this.logger.log('Checking for due content schedules');
    const activated = await this.creatorsService.activateDueContent();
    if (activated && activated.length) {
      this.logger.log(`Activated ${activated.length} schedules`);
    }
  }
}
