import { Test, TestingModule } from '@nestjs/testing';
import { PassesService } from './passes.service';
import { PrismaService } from '../common/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { EmailService } from '../notifications/email.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('PassesService', () => {
  let service: PassesService;
  let prisma: PrismaService;
  let webhooksService: WebhooksService;

  const mockPrismaService = {
    creator: {
      findUnique: jest.fn(),
    },
    tier: {
      findFirst: jest.fn(),
    },
    fan: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    pass: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockWebhooksService = {
    deliverPassPurchaseWebhook: jest.fn().mockResolvedValue(undefined),
  };

  const mockEmailService = {
    sendPassPurchaseEmail: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PassesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: WebhooksService,
          useValue: mockWebhooksService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<PassesService>(PassesService);
    prisma = module.get<PrismaService>(PrismaService);
    webhooksService = module.get<WebhooksService>(WebhooksService);

    jest.clearAllMocks();
  });

  describe('upsertFromChain', () => {
    const mockData = {
      onChainId: BigInt(1),
      tierOnChainId: 10,
      creatorAddress: 'GB_CREATOR',
      fanAddress: 'GB_FAN',
      purchasedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      txHash: 'tx-hash',
    };

    const mockCreator = { id: 'creator-uuid', stellarAddress: 'GB_CREATOR' };
    const mockTier = { id: 'tier-uuid', onChainId: 10, creatorId: 'creator-uuid' };
    const mockFan = { id: 'fan-uuid', stellarAddress: 'GB_FAN' };
    const mockPass = { id: 'pass-uuid', onChainId: BigInt(1), creatorId: 'creator-uuid' };

    beforeEach(() => {
      mockPrismaService.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrismaService.tier.findFirst.mockResolvedValue(mockTier);
      mockPrismaService.fan.upsert.mockResolvedValue(mockFan);
    });

    it('should create new pass and trigger webhook delivery', async () => {
      mockPrismaService.pass.findUnique.mockResolvedValue(null);
      mockPrismaService.pass.upsert.mockResolvedValue(mockPass);

      const result = await service.upsertFromChain(mockData);

      expect(prisma.pass.findUnique).toHaveBeenCalledWith({
        where: { onChainId: mockData.onChainId },
      });
      expect(prisma.pass.upsert).toHaveBeenCalled();
      expect(prisma.pass.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            txHash: mockData.txHash,
          }),
        }),
      );
      expect(webhooksService.deliverPassPurchaseWebhook).toHaveBeenCalledWith(
        mockCreator.id,
        mockPass
      );
      expect(result).toEqual(mockPass);
    });

    it('should update existing pass and NOT trigger webhook delivery', async () => {
      mockPrismaService.pass.findUnique.mockResolvedValue(mockPass);
      mockPrismaService.pass.upsert.mockResolvedValue(mockPass);

      const result = await service.upsertFromChain(mockData);

      expect(prisma.pass.findUnique).toHaveBeenCalledWith({
        where: { onChainId: mockData.onChainId },
      });
      expect(prisma.pass.upsert).toHaveBeenCalled();
      expect(webhooksService.deliverPassPurchaseWebhook).not.toHaveBeenCalled();
      expect(result).toEqual(mockPass);
    });
  });

  describe('getReceipt', () => {
    const purchasedAt = new Date('2026-01-01T00:00:00Z');
    const mockReceiptPass = {
      id: 'pass-uuid',
      onChainId: BigInt(1),
      tierId: 'tier-uuid',
      creatorId: 'creator-uuid',
      fanId: 'fan-uuid',
      purchasedAt,
      expiresAt: new Date('2026-02-01T00:00:00Z'),
      active: true,
      syncedAt: new Date('2026-01-01T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      txHash: 'tx-hash',
      tier: {
        id: 'tier-uuid',
        priceUsdc: '10.00',
      },
      creator: {
        id: 'creator-uuid',
        stellarAddress: 'GB_CREATOR',
      },
      fan: {
        id: 'fan-uuid',
        stellarAddress: 'GB_FAN',
      },
    };

    it('should return receipt details for the pass owner', async () => {
      mockPrismaService.pass.findUnique.mockResolvedValue(mockReceiptPass);

      const result = await service.getReceipt('pass-uuid', 'GB_FAN');

      expect(prisma.pass.findUnique).toHaveBeenCalledWith({
        where: { id: 'pass-uuid' },
        include: {
          tier: true,
          creator: true,
          fan: true,
        },
      });
      expect(result).toEqual({
        pass: {
          id: 'pass-uuid',
          onChainId: BigInt(1),
          tierId: 'tier-uuid',
          creatorId: 'creator-uuid',
          fanId: 'fan-uuid',
          purchasedAt,
          expiresAt: new Date('2026-02-01T00:00:00Z'),
          active: true,
          syncedAt: new Date('2026-01-01T00:00:00Z'),
          createdAt: new Date('2026-01-01T00:00:00Z'),
          txHash: 'tx-hash',
        },
        tier: mockReceiptPass.tier,
        creator: mockReceiptPass.creator,
        purchasedAt,
        amount: '10.00',
        txHash: 'tx-hash',
      });
    });

    it('should throw ForbiddenException when another fan requests the receipt', async () => {
      mockPrismaService.pass.findUnique.mockResolvedValue(mockReceiptPass);

      await expect(service.getReceipt('pass-uuid', 'GB_OTHER')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when the pass does not exist', async () => {
      mockPrismaService.pass.findUnique.mockResolvedValue(null);

      await expect(service.getReceipt('missing-pass', 'GB_FAN')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
