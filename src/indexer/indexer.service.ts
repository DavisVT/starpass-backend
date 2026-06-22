import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import { TiersService } from '../tiers/tiers.service';
import { PassesService } from '../passes/passes.service';
import { ReindexDto, ReindexJobStatusDto } from './dto/reindex.dto';
import { randomUUID } from 'crypto';

const MAX_LEDGER_RANGE = 10000;

@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly logger = new Logger(IndexerService.name);
  private isRunning = false;
  private intervalMs: number;

  // In-memory job storage (for async job tracking)
  private reindexJobs: Map<string, ReindexJobStatusDto> = new Map();

  constructor(
    private prisma: PrismaService,
    private stellar: StellarService,
    private tiers: TiersService,
    private passes: PassesService,
    private config: ConfigService,
  ) {
    this.intervalMs = parseInt(this.config.get('INDEXER_INTERVAL_MS') || '10000');
  }

  onModuleInit() {
    if (this.config.get('INDEXER_ENABLED') !== 'false') {
      this.logger.log('Starting StarPass event indexer...');
      this.startPolling();
    }
  }

  /**
   * Start polling for new on-chain events
   */
  private startPolling() {
    setInterval(async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      try {
        await this.processNewEvents();
      } catch (error) {
        this.logger.error(`Indexer error: ${error.message}`);
      } finally {
        this.isRunning = false;
      }
    }, this.intervalMs);
  }

  /**
   * Fetch and process new events since last checkpoint
   */
  async processNewEvents() {
    const checkpoint = await this.getCheckpoint();
    const latestLedger = await this.stellar.getLatestLedger();

    if (checkpoint >= latestLedger) return;

    const events = await this.stellar.getContractEvents(checkpoint);

    for (const event of events) {
      await this.processEvent(event);
    }

    await this.updateCheckpoint(latestLedger);
    if (events.length > 0) {
      this.logger.log(`Indexed ${events.length} events up to ledger ${latestLedger}`);
    }
  }

  /**
   * Process a single contract event
   */
  private async processEvent(event: any) {
    try {
      const topic = event.topic?.[0]?.toString();

      switch (topic) {
        case 'tier_created':
          await this.handleTierCreated(event);
          break;
        case 'tier_deactivated':
          await this.handleTierDeactivated(event);
          break;
        case 'pass_minted':
          await this.handlePassMinted(event);
          break;
        case 'creator_registered':
          await this.handleCreatorRegistered(event);
          break;
        default:
          break;
      }
    } catch (error) {
      this.logger.error(`Error processing event: ${error.message}`);
    }
  }

  private async handleCreatorRegistered(event: any) {
    const [creatorAddress] = event.value?.vec || [];
    if (!creatorAddress) return;

    await this.prisma.user.upsert({
      where: { stellarAddress: creatorAddress.toString() },
      update: {},
      create: { stellarAddress: creatorAddress.toString(), role: 'CREATOR' },
    });
  }

  private async handleTierCreated(event: any) {
    const [tierId, creatorAddress, price, duration] = event.value?.vec || [];
    if (!tierId || !creatorAddress) return;

    await this.tiers.upsertFromChain({
      onChainId: Number(tierId),
      creatorAddress: creatorAddress.toString(),
      name: `Tier ${tierId}`,
      priceUsdc: (Number(price) / 1_000_000).toString(),
      durationSeconds: Number(duration),
      maxSupply: 0,
      minted: 0,
      active: true,
    });
  }

  private async handleTierDeactivated(event: any) {
    const [tierId, creatorAddress] = event.value?.vec || [];
    if (!tierId || !creatorAddress) return;

    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress: creatorAddress.toString() },
    });
    if (!creator) return;

    await this.prisma.tier.updateMany({
      where: { onChainId: Number(tierId), creatorId: creator.id },
      data: { active: false },
    });
  }

  private async handlePassMinted(event: any) {
    const [passId, tierId, fanAddress, expiresAt] = event.value?.vec || [];
    if (!passId || !fanAddress) return;

    const tier = await this.prisma.tier.findFirst({
      where: { onChainId: Number(tierId) },
      include: { creator: true },
    });
    if (!tier) return;

    const expiryDate = new Date(Number(expiresAt) * 1000);
    const purchasedAt = new Date();

    await this.passes.upsertFromChain({
      onChainId: BigInt(passId),
      tierOnChainId: Number(tierId),
      creatorAddress: tier.creator.stellarAddress,
      fanAddress: fanAddress.toString(),
      purchasedAt,
      expiresAt: expiryDate,
      txHash: event.txHash ?? event.transactionHash ?? event.tx_hash ?? null,
    });
  }

  private async getCheckpoint(): Promise<number> {
    const checkpoint = await this.prisma.indexerCheckpoint.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton', lastLedger: 0 },
    });
    return checkpoint.lastLedger;
  }

  private async updateCheckpoint(ledger: number) {
    await this.prisma.indexerCheckpoint.update({
      where: { id: 'singleton' },
      data: { lastLedger: ledger },
    });
  }

  /**
   * Start an asynchronous reindex job for a specific ledger range.
   * Validates the range and returns a job ID immediately.
   *
   * @param dto The reindex request containing fromLedger and toLedger
   * @returns An object with jobId and status
   */
  async startReindex(dto: ReindexDto): Promise<{ jobId: string }> {
    const { fromLedger, toLedger } = dto;

    // Validate range
    if (toLedger < fromLedger) {
      throw new BadRequestException('toLedger must be greater than or equal to fromLedger');
    }

    const range = toLedger - fromLedger + 1;
    if (range > MAX_LEDGER_RANGE) {
      throw new BadRequestException(
        `Ledger range exceeds maximum of ${MAX_LEDGER_RANGE}. Requested range: ${range}`,
      );
    }

    // Create job
    const jobId = randomUUID();
    const job: ReindexJobStatusDto = {
      jobId,
      status: 'pending',
      fromLedger,
      toLedger,
      eventsProcessed: 0,
      createdAt: new Date(),
    };

    this.reindexJobs.set(jobId, job);

    // Start processing asynchronously (fire and forget)
    this.executeReindexJob(jobId).catch((err) => {
      this.logger.error(`Reindex job ${jobId} failed: ${err.message}`);
    });

    return { jobId };
  }

  /**
   * Execute the reindex job asynchronously.
   * Processes events in the specified ledger range idempotently.
   */
  private async executeReindexJob(jobId: string): Promise<void> {
    const job = this.reindexJobs.get(jobId);
    if (!job) return;

    job.status = 'running';

    try {
      const { fromLedger, toLedger } = job;
      let eventsProcessed = 0;

      // Process events from the specified range
      // We iterate through the range and fetch events for each ledger
      for (let ledger = fromLedger!; ledger <= toLedger!; ledger++) {
        try {
          const events = await this.stellar.getContractEvents(ledger);

          for (const event of events) {
            // Process each event - the handlers use upsert, ensuring idempotency
            await this.processEvent(event);
            eventsProcessed++;
          }
        } catch (error) {
          this.logger.warn(`Error processing ledger ${ledger}: ${error.message}`);
          // Continue with next ledger
        }
      }

      job.status = 'completed';
      job.eventsProcessed = eventsProcessed;
      job.completedAt = new Date();

      this.logger.log(`Reindex job ${jobId} completed: ${eventsProcessed} events processed`);
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
      this.logger.error(`Reindex job ${jobId} failed: ${error.message}`);
    }
  }

  /**
   * Get the status of a reindex job.
   *
   * @param jobId The job ID to query
   * @returns The job status or throws NotFoundException
   */
  getReindexJobStatus(jobId: string): ReindexJobStatusDto {
    const job = this.reindexJobs.get(jobId);
    if (!job) {
      throw new BadRequestException(`Reindex job ${jobId} not found`);
    }
    return job;
  }
}
