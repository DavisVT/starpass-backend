import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TiersService } from './tiers.service';
import { PrismaService } from '../common/prisma.service';

describe('TiersService', () => {
  let service: TiersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    creator: {
      findUnique: jest.fn(),
    },
    tier: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    pass: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
  

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TiersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TiersService>(TiersService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated tiers with total count', async () => {
      const tiers = [{ id: 'tier-1', creatorId: 'creator-1', onChainId: 1 }];
      mockPrismaService.tier.findMany.mockResolvedValue(tiers);
      mockPrismaService.tier.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result).toEqual({ data: tiers, total: 1, page: 1, limit: 20 });
      expect(prisma.tier.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { onChainId: 'asc' },
      });
      expect(prisma.tier.count).toHaveBeenCalledWith({ where: {} });
    });

    it('should apply page, limit, and creatorId filter', async () => {
      mockPrismaService.tier.findMany.mockResolvedValue([]);
      mockPrismaService.tier.count.mockResolvedValue(0);

      const result = await service.findAll(3, 10, 'creator-123');

      expect(result).toEqual({ data: [], total: 0, page: 3, limit: 10 });
      expect(prisma.tier.findMany).toHaveBeenCalledWith({
        where: { creatorId: 'creator-123' },
        skip: 20,
        take: 10,
        orderBy: { onChainId: 'asc' },
      });
      expect(prisma.tier.count).toHaveBeenCalledWith({
        where: { creatorId: 'creator-123' },
      });
    });
  });

  describe('getAnalytics', () => {
    const tierId = 'tier-1';
    const mockTier = {
      id: tierId,
      priceUsdc: '15.00',
      creator: { userId: 'user-123' },
    };

    beforeEach(() => {
      mockPrismaService.tier.findUnique.mockResolvedValue(mockTier);
      mockPrismaService.pass.findMany.mockResolvedValue([
        { purchasedAt: new Date('2026-06-10T00:00:00Z') },
        { purchasedAt: new Date('2026-06-11T00:00:00Z') },
      ]);
      mockPrismaService.pass.count.mockResolvedValue(5);
    });

    it('should compute analytics for the tier owner', async () => {
      jest.useFakeTimers({ now: new Date('2026-06-15T12:00:00Z') });

      const result = await service.getAnalytics(tierId, 'user-123', '30d');

      expect(result).toEqual({
        totalPurchases: 2,
        totalRevenue: 30,
        activePasses: 5,
        purchasesByDay: expect.any(Array),
      });
      expect(result.purchasesByDay).toHaveLength(30);

      jest.useRealTimers();
    });

    it('should throw NotFoundException when tier does not exist', async () => {
      mockPrismaService.tier.findUnique.mockResolvedValue(null);

      await expect(service.getAnalytics('missing', 'user-123')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw ForbiddenException when user is not the tier creator', async () => {
      await expect(service.getAnalytics(tierId, 'user-456')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should throw BadRequestException for invalid period', async () => {
      await expect(service.getAnalytics(tierId, 'user-123', '1y')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
