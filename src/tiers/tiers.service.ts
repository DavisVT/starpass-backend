import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { EmailService } from '../notifications/email.service';
import { CreateTierDto } from './dto/create-tier.dto';

const UNLOCK_TTL_SECONDS = 15 * 60; // 15 minutes

@Injectable()
export class TiersService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
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

  // ── Content unlock ────────────────────────────────────────────────────────

  private sign(payload: string): string {
    const secret = this.config.get<string>('CONTENT_URL_SECRET')!;
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Issue a signed temporary content URL for a verified pass holder.
   * The caller must have an active, non-expired pass for the tier.
   */
  async unlockContent(tierId: string, fanAddress: string): Promise<{ token: string; expiresAt: string }> {
    const tier = await this.prisma.tier.findUnique({ where: { id: tierId } });
    if (!tier) throw new NotFoundException('Tier not found');

    const fan = await this.prisma.fan.findUnique({ where: { stellarAddress: fanAddress } });
    const hasPass = fan
      ? !!(await this.prisma.pass.findFirst({
          where: { fanId: fan.id, tierId, active: true, expiresAt: { gt: new Date() } },
        }))
      : false;

    if (!hasPass) throw new ForbiddenException('No valid pass for this tier');

    const expiresAt = Math.floor(Date.now() / 1000) + UNLOCK_TTL_SECONDS;
    const payload = `${tierId}:${fanAddress}:${expiresAt}`;
    const sig = this.sign(payload);
    // token = base64(payload):sig
    const token = `${Buffer.from(payload).toString('base64url')}.${sig}`;

    return { token, expiresAt: new Date(expiresAt * 1000).toISOString() };
  }

  /**
   * Verify a previously issued content unlock token.
   */
  verifyContentToken(tierId: string, token: string): { valid: boolean; fanAddress?: string } {
    try {
      const [encodedPayload, sig] = token.split('.');
      if (!encodedPayload || !sig) return { valid: false };

      const payload = Buffer.from(encodedPayload, 'base64url').toString();
      const [payloadTierId, fanAddress, expiresAtStr] = payload.split(':');

      if (payloadTierId !== tierId) return { valid: false };

      const expiresAt = parseInt(expiresAtStr, 10);
      if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) return { valid: false };

      const expectedSig = this.sign(payload);
      if (expectedSig !== sig) return { valid: false };

      return { valid: true, fanAddress };
    } catch {
      return { valid: false };
    }
  }
}
