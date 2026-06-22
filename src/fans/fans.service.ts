import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class FansService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find a fan by their Stellar address along with their active passes.
   * 
   * @param stellarAddress The Stellar public key of the fan.
   * @returns The fan record including their active passes, tiers, and creators.
   * @throws {NotFoundException} If the fan is not found.
   */
  async findByAddress(stellarAddress: string) {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress },
      include: {
        passes: {
          where: { active: true, expiresAt: { gt: new Date() } },
          include: { tier: true, creator: true },
        },
      },
    });

    if (!fan) throw new NotFoundException('Fan not found');
    return fan;
  }

  /**
   * Get all active subscriptions (passes) for a fan.
   * 
   * @param stellarAddress The Stellar public key of the fan.
   * @returns A list of active passes with their associated creator and tier details.
   * @throws {NotFoundException} If the fan is not found.
   */
  async getSubscriptions(stellarAddress: string) {
    const fan = await this.prisma.fan.findUnique({
      where: { stellarAddress },
    });

    if (!fan) throw new NotFoundException('Fan not found');

    const now = new Date();
    return this.prisma.pass.findMany({
      where: { fanId: fan.id, active: true, expiresAt: { gt: now } },
      include: { creator: true, tier: true },
      orderBy: { expiresAt: 'asc' },
    });
  }

  async getActivity(
    stellarAddress: string,
    typeFilter: string | undefined,
    page: number,
    limit: number,
  ) {
    const fan = await this.prisma.fan.findUnique({ where: { stellarAddress } });
    if (!fan) throw new NotFoundException('Fan not found');

    const skip = (page - 1) * limit;
    const now = new Date();

    const passes = await this.prisma.pass.findMany({
      where: { fanId: fan.id },
      include: { tier: { select: { name: true, onChainId: true } }, creator: { select: { displayName: true, stellarAddress: true } } },
      orderBy: { purchasedAt: 'desc' },
    });

    const events: Array<{ type: string; data: Record<string, unknown>; createdAt: Date }> = [];

    for (const pass of passes) {
      events.push({
        type: 'pass_purchased',
        data: {
          passId: pass.id,
          tierName: pass.tier.name,
          creatorName: pass.creator.displayName,
          creatorAddress: pass.creator.stellarAddress,
          expiresAt: pass.expiresAt,
        },
        createdAt: pass.purchasedAt,
      });

      if (pass.expiresAt < now) {
        events.push({
          type: 'pass_expired',
          data: {
            passId: pass.id,
            tierName: pass.tier.name,
            creatorName: pass.creator.displayName,
          },
          createdAt: pass.expiresAt,
        });
      }
    }

    const filtered = typeFilter
      ? events.filter((e) => e.type === typeFilter)
      : events;

    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filtered.length;
    const data = filtered.slice(skip, skip + limit);

    return { data, total, page, limit };
  }
}
