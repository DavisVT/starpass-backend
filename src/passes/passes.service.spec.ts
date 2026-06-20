import { Test, TestingModule } from '@nestjs/testing';
import { PassesService } from './passes.service';
import { PrismaService } from '../common/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';

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
});
