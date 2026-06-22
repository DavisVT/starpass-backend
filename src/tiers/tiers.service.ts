import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { EmailService } from '../notifications/email.service';

@Injectable()
export class TiersService {
  private readonly logger = new Logger(TiersService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Get all active tiers for a creator
   * 
   * @param stellarAddress The Stellar public key of the creator.
   * @returns A list of active tiers for the given creator.
   * @throws {NotFoundException} If the creator is not found.
   */
  async findByCreator(stellarAddress: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress },
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    return this.prisma.tier.findMany({
      where: { creatorId: creator.id, active: true },
      orderBy: { onChainId: 'asc' },
    });
  }

  /**
   * Get a single tier by on-chain ID and creator address
   * 
   * @param stellarAddress The Stellar public key of the creator.
   * @param onChainId The on-chain ID of the tier.
   * @returns The tier record.
   * @throws {NotFoundException} If either the creator or the tier is not found.
   */
  async findOne(stellarAddress: string, onChainId: number) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress },
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    const tier = await this.prisma.tier.findUnique({
      where: { creatorId_onChainId: { creatorId: creator.id, onChainId } },
    });

    if (!tier) {
      throw new NotFoundException('Tier not found');
    }

    return tier;
  }

  /**
   * Upsert a tier from on-chain event data (called by indexer)
   * 
   * @param data The event data containing tier details from the blockchain.
   * @returns The upserted tier record, or null if the creator is not found.
   */
  async upsertFromChain(data: {
    onChainId: number;
    creatorAddress: string;
    name: string;
    priceUsdc: string;
    durationSeconds: number;
    maxSupply: number;
    minted: number;
    active: boolean;
  }) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress: data.creatorAddress },
    });

    if (!creator) return null;

    const durationDays = Math.floor(data.durationSeconds / 86400);

    return this.prisma.tier.upsert({
      where: {
        creatorId_onChainId: {
          creatorId: creator.id,
          onChainId: data.onChainId,
        },
      },
      update: {
        name: data.name,
        priceUsdc: data.priceUsdc,
        durationDays,
        maxSupply: data.maxSupply,
        minted: data.minted,
        active: data.active,
        syncedAt: new Date(),
      },
      create: {
        onChainId: data.onChainId,
        creatorId: creator.id,
        name: data.name,
        priceUsdc: data.priceUsdc,
        durationDays,
        maxSupply: data.maxSupply,
        minted: data.minted,
        active: data.active,
        syncedAt: new Date(),
      },
    });
  }

  /**
   * Join the waitlist for a sold-out tier
   */
  async joinWaitlist(tierId: string, fanAddress: string) {
    const tier = await this.prisma.tier.findUnique({
      where: { id: tierId },
      include: { creator: true },
    });

    if (!tier) {
      throw new NotFoundException('Tier not found');
    }

    // Check if tier has max supply and is sold out
    if (tier.maxSupply <= 0) {
      throw new BadRequestException('This tier does not have a limited supply');
    }

    // Count active passes to check if tier is sold out
    const now = new Date();
    const activePassCount = await this.prisma.pass.count({
      where: {
        tierId,
        active: true,
        expiresAt: { gt: now },
      },
    });

    if (activePassCount < tier.maxSupply) {
      throw new BadRequestException('This tier is not sold out yet');
    }

    // Check if fan already has a valid pass for this tier
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress: fanAddress },
    });

    if (fan) {
      const hasPass = await this.prisma.pass.findFirst({
        where: {
          fanId: fan.id,
          tierId,
          active: true,
          expiresAt: { gt: now },
        },
      });

      if (hasPass) {
        throw new BadRequestException('You already have a valid pass for this tier');
      }
    }

    // Join waitlist
    return this.prisma.waitlistEntry.upsert({
      where: {
        tierId_fanAddress: {
          tierId,
          fanAddress,
        },
      },
      update: {},
      create: {
        tierId,
        fanAddress,
      },
    });
  }

  /**
   * Get fan's position on the waitlist
   */
  async getWaitlistPosition(tierId: string, fanAddress: string) {
    const tier = await this.prisma.tier.findUnique({
      where: { id: tierId },
    });

    if (!tier) {
      throw new NotFoundException('Tier not found');
    }

    const waitlist = await this.prisma.waitlistEntry.findMany({
      where: {
        tierId,
        notified: false,
      },
      orderBy: { joinedAt: 'asc' },
    });

    const index = waitlist.findIndex(entry => entry.fanAddress === fanAddress);

    if (index === -1) {
      throw new NotFoundException('You are not on the waitlist for this tier');
    }

    return { position: index + 1, total: waitlist.length };
  }

  /**
   * Notify next fan on waitlist when a slot opens up
   */
  async notifyNextOnWaitlist(tierId: string) {
    const tier = await this.prisma.tier.findUnique({
      where: { id: tierId },
      include: { creator: true },
    });

    if (!tier) {
      return;
    }

    const nextEntry = await this.prisma.waitlistEntry.findFirst({
      where: {
        tierId,
        notified: false,
      },
      orderBy: { joinedAt: 'asc' },
    });

    if (!nextEntry) {
      return;
    }

    // Check if fan has an email (we can notify via email if available)
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress: nextEntry.fanAddress },
    });

    if (fan && fan.displayName) { // Assuming displayName could be email, but let's just notify if possible
      // For now, we'll just mark as notified. In a real app, we'd need to collect email for fans.
      this.logger.log(`Notifying fan ${nextEntry.fanAddress} about slot opening in tier ${tier.name}`);
    }

    // Mark entry as notified
    await this.prisma.waitlistEntry.update({
      where: { id: nextEntry.id },
      data: { notified: true },
    });
  }
}
