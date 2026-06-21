import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import { TiersService } from '../tiers/tiers.service';
import { PassesService } from '../passes/passes.service';

@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly logger = new Logger(IndexerService.name);
  private isRunning = false;
  private intervalMs: number;

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
}
