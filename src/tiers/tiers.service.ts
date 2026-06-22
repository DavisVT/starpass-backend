import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateTierDto } from './dto/create-tier.dto';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class TiersService {
  constructor(private prisma: PrismaService) {}

  async bulkCreate(creatorAddress: string, dtos: CreateTierDto[], callerAddress: string) {
    if (creatorAddress !== callerAddress) {
      throw new ForbiddenException('You can only create tiers for your own profile');
    }

    const creator = await this.prisma.creator.findUnique({ where: { stellarAddress: creatorAddress } });
    if (!creator) throw new NotFoundException('Creator not found');

    return this.prisma.$transaction(
      dtos.map((dto) =>
        this.prisma.tier.create({
          data: {
            onChainId: dto.onChainId,
            creatorId: creator.id,
            name: dto.name,
            description: dto.description,
            priceUsdc: dto.priceUsdc,
            durationDays: dto.durationDays,
            maxSupply: dto.maxSupply ?? 0,
            active: dto.active ?? true,
            syncedAt: new Date(),
          },
        }),
      ),
    );
  }

  async findAll(page: number, limit: number, creatorAddress?: string) {
    const skip = (page - 1) * limit;

    let creatorId: string | undefined;
    if (creatorAddress) {
      const creator = await this.prisma.creator.findUnique({
        where: { stellarAddress: creatorAddress },
        select: { id: true },
      });
      if (!creator) return { data: [], total: 0, page, limit };
      creatorId = creator.id;
    }

    const where = { ...(creatorId ? { creatorId } : {}), active: true };

    const [data, total] = await Promise.all([
      this.prisma.tier.findMany({ where, skip, take: limit, orderBy: { onChainId: 'asc' } }),
      this.prisma.tier.count({ where }),
    ]);

    return { data, total, page, limit };
  }

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
}
