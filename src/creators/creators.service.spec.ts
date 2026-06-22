import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CreatorsService } from './creators.service';
import { PrismaService } from '../common/prisma.service';

describe('CreatorsService', () => {
  let service: CreatorsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    creator: {
      findUnique: jest.fn(),
    },
    pass: {
      findMany: jest.fn(),
    },
    earningsRecord: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CreatorsService>(CreatorsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('getRevenue', () => {
    it('should throw NotFoundException when creator is missing', async () => {
      mockPrismaService.creator.findUnique.mockResolvedValue(null);
      await expect(service.getRevenue('user-123')).rejects.toThrow(NotFoundException);
    });

    it('should return revenue summary and top tiers sorted by revenue', async () => {
      const creator = { id: 'creator-1', totalEarned: '1200.50' };
      const passes = [
        {
          id: 'pass-1',
          tier: { id: 'tier-123', name: 'VIP Access', priceUsdc: '8500.00' },
        },
        {
          id: 'pass-2',
          tier: { id: 'tier-456', name: 'Early Bird', priceUsdc: '5000.00' },
        },
        {
          id: 'pass-3',
          tier: { id: 'tier-789', name: 'Base Tier', priceUsdc: '1949.50' },
        },
        {
          id: 'pass-4',
          tier: { id: 'tier-456', name: 'Early Bird', priceUsdc: '5000.00' },
        },
      ];

      mockPrismaService.creator.findUnique.mockResolvedValue(creator);
      mockPrismaService.pass.findMany.mockResolvedValue(passes);

      const result = await service.getRevenue('user-123');

      expect(result).toEqual({
        totalRevenue: 20449.5,
        totalPasses: 4,
        pendingBalance: 1200.5,
        topTiers: [
          { id: 'tier-456', name: 'Early Bird', revenue: 10000.0 },
          { id: 'tier-123', name: 'VIP Access', revenue: 8500.0 },
          { id: 'tier-789', name: 'Base Tier', revenue: 1949.5 },
        ],
      });

      expect(prisma.creator.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-123' } });
      expect(prisma.pass.findMany).toHaveBeenCalledWith({
        where: { creatorId: creator.id },
        include: { tier: true },
      });
    });

    it('should return empty topTiers when there are no passes', async () => {
      const creator = { id: 'creator-1', totalEarned: '0' };
      mockPrismaService.creator.findUnique.mockResolvedValue(creator);
      mockPrismaService.pass.findMany.mockResolvedValue([]);

      const result = await service.getRevenue('user-123');

      expect(result).toEqual({
        totalRevenue: 0,
        totalPasses: 0,
        pendingBalance: 0,
        topTiers: [],
      });
    });
  });

  describe('getEarningsHistory', () => {
    it('should throw NotFoundException when creator is missing', async () => {
      mockPrismaService.creator.findUnique.mockResolvedValue(null);
      await expect(
        service.getEarningsHistory('user-123', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return paginated earnings records', async () => {
      const creator = { id: 'creator-1' };
      const earningsRecords = [
        {
          id: 'er-1',
          creatorId: 'creator-1',
          fanId: 'fan-1',
          tierId: 'tier-1',
          amount: '10.00',
          fee: '0',
          netAmount: '10.00',
          createdAt: new Date('2024-06-01'),
          fan: { id: 'fan-1', stellarAddress: 'GB_FAN1' },
          tier: { id: 'tier-1', name: 'Gold' },
        },
      ];

      mockPrismaService.creator.findUnique.mockResolvedValue(creator);
      mockPrismaService.earningsRecord.findMany.mockResolvedValue(earningsRecords);
      mockPrismaService.earningsRecord.count.mockResolvedValue(1);

      const result = await service.getEarningsHistory('user-123', { page: 1, limit: 20 });

      expect(result).toEqual({
        data: earningsRecords,
        total: 1,
        page: 1,
        limit: 20,
      });
      expect(mockPrismaService.earningsRecord.findMany).toHaveBeenCalledWith({
        where: { creatorId: 'creator-1' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { fan: true, tier: true },
      });
    });

    it('should apply date range filtering', async () => {
      const creator = { id: 'creator-1' };
      mockPrismaService.creator.findUnique.mockResolvedValue(creator);
      mockPrismaService.earningsRecord.findMany.mockResolvedValue([]);
      mockPrismaService.earningsRecord.count.mockResolvedValue(0);

      await service.getEarningsHistory('user-123', {
        from: '2024-01-01',
        to: '2024-06-30',
        page: 1,
        limit: 10,
      });

      expect(mockPrismaService.earningsRecord.findMany).toHaveBeenCalledWith({
        where: {
          creatorId: 'creator-1',
          createdAt: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-06-30'),
          },
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { fan: true, tier: true },
      });
    });

    it('should handle pagination correctly', async () => {
      const creator = { id: 'creator-1' };
      mockPrismaService.creator.findUnique.mockResolvedValue(creator);
      mockPrismaService.earningsRecord.findMany.mockResolvedValue([]);
      mockPrismaService.earningsRecord.count.mockResolvedValue(50);

      const result = await service.getEarningsHistory('user-123', { page: 3, limit: 10 });

      expect(result).toEqual({ data: [], total: 50, page: 3, limit: 10 });
      expect(mockPrismaService.earningsRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });
});
