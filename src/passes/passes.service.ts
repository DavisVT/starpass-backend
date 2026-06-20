import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ListPassesDto } from './dto/list-passes.dto';

@Injectable()
export class PassesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Check if a fan has a valid pass for a specific tier
   * This is the core access-gating function
   */
  async hasValidPass(fanAddress: string, tierId: string): Promise<boolean> {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress: fanAddress },
    });

    if (!fan) return false;

    const now = new Date();
    const pass = await this.prisma.pass.findFirst({
      where: {
        fanId: fan.id,
        tierId,
        active: true,
        expiresAt: { gt: now },
      },
    });

    return !!pass;
  }

  /**
   * Check if a fan has any valid pass from a creator
   */
  async hasAnyValidPass(fanAddress: string, creatorAddress: string): Promise<boolean> {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress: fanAddress },
    });
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress: creatorAddress },
    });

    if (!fan || !creator) return false;

    const now = new Date();
    const pass = await this.prisma.pass.findFirst({
      where: {
        fanId: fan.id,
        creatorId: creator.id,
        active: true,
        expiresAt: { gt: now },
      },
    });

    return !!pass;
  }

  /**
   * Get all passes for a fan
   */
  async findByFan(fanAddress: string, activeOnly = false) {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress: fanAddress },
    });

    if (!fan) {
      throw new NotFoundException('Fan not found');
    }

    const now = new Date();
    return this.prisma.pass.findMany({
      where: {
        fanId: fan.id,
        ...(activeOnly ? { active: true, expiresAt: { gt: now } } : {}),
      },
      include: { tier: true, creator: true },
      orderBy: { purchasedAt: 'desc' },
    });
  }

  /**
   * Get pass count for a creator
   */
  async getCreatorPassCount(creatorAddress: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { stellarAddress: creatorAddress },
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    const now = new Date();
    const [total, active] = await Promise.all([
      this.prisma.pass.count({ where: { creatorId: creator.id } }),
      this.prisma.pass.count({
        where: { creatorId: creator.id, active: true, expiresAt: { gt: now } },
      }),
    ]);

    return { total, active };
  }

  /**
   * Upsert a pass from on-chain event data (called by indexer)
   */
  async upsertFromChain(data: {
    onChainId: bigint;
    tierOnChainId: number;
    creatorAddress: string;
    fanAddress: string;
    purchasedAt: Date;
    expiresAt: Date;
  }) {
    const [creator, tier] = await Promise.all([
      this.prisma.creator.findUnique({ where: { stellarAddress: data.creatorAddress } }),
      this.prisma.tier.findFirst({
        where: {
          onChainId: data.tierOnChainId,
          creator: { stellarAddress: data.creatorAddress },
        },
      }),
    ]);

    if (!creator || !tier) return null;

    // Upsert fan
    const fan = await this.prisma.fan.upsert({
      where: { stellarAddress: data.fanAddress },
      update: {},
      create: {
        stellarAddress: data.fanAddress,
        user: {
          connectOrCreate: {
            where: { stellarAddress: data.fanAddress },
            create: { stellarAddress: data.fanAddress },
          },
        },
      },
    });

    return this.prisma.pass.upsert({
      where: { onChainId: data.onChainId },
      update: {
        expiresAt: data.expiresAt,
        syncedAt: new Date(),
      },
      create: {
        onChainId: data.onChainId,
        tierId: tier.id,
        creatorId: creator.id,
        fanId: fan.id,
        purchasedAt: data.purchasedAt,
        expiresAt: data.expiresAt,
        syncedAt: new Date(),
      },
    });
  }

  /**
   * Find all passes with filtering and pagination
   */
  async findAll(filters: ListPassesDto) {
    const { fan, tier_id, active, expired, page = 1, limit = 20 } = filters;
    const now = new Date();

    const where: any = {};

    if (fan) {
      where.fan = {
        stellarAddress: fan,
      };
    }

    if (tier_id) {
      where.tierId = tier_id;
    }

    if (active !== undefined) {
      where.active = active;
    }

    if (expired !== undefined) {
      where.expiresAt = expired ? { lte: now } : { gt: now };
    }

    const skip = (page - 1) * limit;
    const take = limit;

    const [data, total] = await Promise.all([
      this.prisma.pass.findMany({
        where,
        skip,
        take,
        include: {
          tier: true,
          creator: true,
          fan: true,
        },
        orderBy: {
          purchasedAt: 'desc',
        },
      }),
      this.prisma.pass.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }
}
