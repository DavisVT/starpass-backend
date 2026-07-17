import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreatorsService } from './creators.service';
import { PrismaService } from '../common/prisma.service';


describe('CreatorsService', () => {
  let service: CreatorsService;

  const mockPrismaService = {
    creator: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    pass: {
      findMany: jest.fn(),
    },
    payout: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    earningsRecord: {
      create: jest.fn(),
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
    jest.clearAllMocks();
  });

  // ─── getRevenue ────────────────────────────────────────────────────────────

  describe('getRevenue', () => {
    it('should throw NotFoundException when creator is missing', async () => {
      mockPrismaService.creator.findUnique.mockResolvedValue(null);
      await expect(service.getRevenue('user-123')).rejects.toThrow(NotFoundException);
    });

    it('should return revenue summary and top tiers sorted by revenue', async () => {
      const creator = { id: 'creator-1', totalEarned: '1200.50' };
      const passes = [
        { id: 'pass-1', tier: { id: 'tier-123', name: 'VIP Access', priceUsdc: '8500.00' } },
        { id: 'pass-2', tier: { id: 'tier-456', name: 'Early Bird', priceUsdc: '5000.00' } },
        { id: 'pass-3', tier: { id: 'tier-789', name: 'Base Tier', priceUsdc: '1949.50' } },
        { id: 'pass-4', tier: { id: 'tier-456', name: 'Early Bird', priceUsdc: '5000.00' } },
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

      expect(mockPrismaService.creator.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-123' } });
      expect(mockPrismaService.pass.findMany).toHaveBeenCalledWith({
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

  // ─── recordPayout ──────────────────────────────────────────────────────────

  describe('recordPayout', () => {
    const mockCreator = { id: 'creator-uuid', userId: 'user-uuid', stellarAddress: 'GB_CREATOR' };

    it('should create and return a payout record on successful withdrawal', async () => {
      const mockPayout = {
        id: 'payout-uuid',
        creatorId: 'creator-uuid',
        amount: '50.00',
        txHash: 'stellar-tx-abc',
        status: 'COMPLETED',
        createdAt: new Date(),
      };
      mockPrismaService.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrismaService.payout.create.mockResolvedValue(mockPayout);

      const result = await service.recordPayout('creator-uuid', '50.00', 'stellar-tx-abc');

      expect(mockPrismaService.payout.create).toHaveBeenCalledWith({
        data: {
          creatorId: 'creator-uuid',
          amount: '50.00',
          txHash: 'stellar-tx-abc',
          status: 'COMPLETED',
        },
      });
      expect(result).toEqual(mockPayout);
    });

    it('should record a payout with FAILED status', async () => {
      const mockPayout = {
        id: 'payout-uuid-2',
        creatorId: 'creator-uuid',
        amount: '25.00',
        txHash: null,
        status: 'FAILED',
        createdAt: new Date(),
      };
      mockPrismaService.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrismaService.payout.create.mockResolvedValue(mockPayout);

      const result = await service.recordPayout('creator-uuid', '25.00', null, 'FAILED');

      expect(mockPrismaService.payout.create).toHaveBeenCalledWith({
        data: {
          creatorId: 'creator-uuid',
          amount: '25.00',
          txHash: null,
          status: 'FAILED',
        },
      });
      expect(result.status).toBe('FAILED');
    });

    it('should throw NotFoundException when creator does not exist', async () => {
      mockPrismaService.creator.findUnique.mockResolvedValue(null);

      await expect(
        service.recordPayout('nonexistent-id', '10.00'),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.payout.create).not.toHaveBeenCalled();
    });
  });

  // ─── getPayouts ────────────────────────────────────────────────────────────

  describe('getPayouts', () => {
    const mockCreator = { id: 'creator-uuid', userId: 'user-uuid' };
    const mockPayouts = [
      { id: 'p1', creatorId: 'creator-uuid', amount: '100.00', txHash: 'tx1', status: 'COMPLETED', createdAt: new Date() },
      { id: 'p2', creatorId: 'creator-uuid', amount: '50.00', txHash: 'tx2', status: 'COMPLETED', createdAt: new Date() },
    ];

    it('should return paginated payouts for the owning creator', async () => {
      mockPrismaService.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrismaService.payout.findMany.mockResolvedValue(mockPayouts);
      mockPrismaService.payout.count.mockResolvedValue(2);

      const result = await service.getPayouts('user-uuid', 'user-uuid', { page: 1, limit: 20 });

      expect(mockPrismaService.payout.findMany).toHaveBeenCalledWith({
        where: { creatorId: 'creator-uuid' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(mockPrismaService.payout.count).toHaveBeenCalledWith({ where: { creatorId: 'creator-uuid' } });
      expect(result).toEqual({ data: mockPayouts, total: 2, page: 1, limit: 20 });
    });

    it('should apply pagination correctly on page 2', async () => {
      mockPrismaService.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrismaService.payout.findMany.mockResolvedValue([]);
      mockPrismaService.payout.count.mockResolvedValue(5);

      await service.getPayouts('user-uuid', 'user-uuid', { page: 2, limit: 2 });

      expect(mockPrismaService.payout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 2, take: 2 }),
      );
    });

    it('should throw ForbiddenException when a different user requests the payouts', async () => {
      await expect(
        service.getPayouts('user-uuid', 'different-user-uuid', { page: 1, limit: 20 }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrismaService.creator.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaService.payout.findMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when creator record is not found', async () => {
      mockPrismaService.creator.findUnique.mockResolvedValue(null);

      await expect(
        service.getPayouts('user-uuid', 'user-uuid', { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.payout.findMany).not.toHaveBeenCalled();
    });

    it('should return empty data array when creator has no payouts', async () => {
      mockPrismaService.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrismaService.payout.findMany.mockResolvedValue([]);
      mockPrismaService.payout.count.mockResolvedValue(0);

      const result = await service.getPayouts('user-uuid', 'user-uuid', { page: 1, limit: 20 });

      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
    });
  });

  // ─── getEarningsHistory ────────────────────────────────────────────────────

  describe('getEarningsHistory', () => {
    const mockCreator = { id: 'creator-uuid', userId: 'user-uuid' };

    const mockRecords = [
      {
        id: 'rec-1',
        creatorId: 'creator-uuid',
        fanId: 'fan-uuid',
        tierId: 'tier-uuid',
        amount: 25,
        fee: 0,
        netAmount: 25,
        createdAt: new Date('2026-06-10T12:00:00Z'),
        fan: { id: 'fan-uuid', stellarAddress: 'GB_FAN' },
        tier: { id: 'tier-uuid', name: 'Gold' },
      },
      {
        id: 'rec-2',
        creatorId: 'creator-uuid',
        fanId: 'fan-uuid-2',
        tierId: 'tier-uuid',
        amount: 25,
        fee: 0,
        netAmount: 25,
        createdAt: new Date('2026-05-01T00:00:00Z'),
        fan: { id: 'fan-uuid-2', stellarAddress: 'GB_FAN2' },
        tier: { id: 'tier-uuid', name: 'Gold' },
      },
    ];

    beforeEach(() => {
      mockPrismaService.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrismaService.earningsRecord.findMany.mockResolvedValue(mockRecords);
      mockPrismaService.earningsRecord.count.mockResolvedValue(mockRecords.length);
    });

    it('earnings record is created on a successful pass purchase with correct amount/fee/netAmount', async () => {
      mockPrismaService.earningsRecord.create.mockResolvedValue({
        id: 'rec-new',
        creatorId: 'creator-uuid',
        fanId: 'fan-uuid',
        tierId: 'tier-uuid',
        amount: 25,
        fee: 0,
        netAmount: 25,
        createdAt: new Date(),
      });

      const result = await service.recordEarning('creator-uuid', 'fan-uuid', 'tier-uuid', 25);

      expect(mockPrismaService.earningsRecord.create).toHaveBeenCalledWith({
        data: {
          creatorId: 'creator-uuid',
          fanId: 'fan-uuid',
          tierId: 'tier-uuid',
          amount: 25,
          fee: 0,
          netAmount: 25,
        },
      });
      expect(result.amount).toBe(25);
      expect(result.fee).toBe(0);
      expect(result.netAmount).toBe(25);
    });

    it('GET earnings returns paginated results for the owning creator', async () => {
      const result = await service.getEarningsHistory('user-uuid', { page: 1, limit: 20 });

      expect(mockPrismaService.earningsRecord.findMany).toHaveBeenCalledWith({
        where: { creatorId: 'creator-uuid' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { fan: true, tier: true },
      });
      expect(mockPrismaService.earningsRecord.count).toHaveBeenCalledWith({
        where: { creatorId: 'creator-uuid' },
      });
      expect(result).toEqual({ data: mockRecords, total: 2, page: 1, limit: 20 });
    });

    it('from/to filtering returns only records in range', async () => {
      const inRangeRecords = [mockRecords[0]];
      mockPrismaService.earningsRecord.findMany.mockResolvedValue(inRangeRecords);
      mockPrismaService.earningsRecord.count.mockResolvedValue(1);

      const result = await service.getEarningsHistory('user-uuid', {
        from: '2026-06-01',
        to: '2026-06-30',
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.earningsRecord.findMany).toHaveBeenCalledWith({
        where: {
          creatorId: 'creator-uuid',
          createdAt: {
            gte: new Date('2026-06-01'),
            lte: new Date('2026-06-30'),
          },
        },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: { fan: true, tier: true },
      });
      expect(result).toEqual({ data: inRangeRecords, total: 1, page: 1, limit: 20 });
    });

    it('invalid date range (from > to) returns 400', async () => {
      await expect(
        service.getEarningsHistory('user-uuid', {
          from: '2026-06-30',
          to: '2026-06-01',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.earningsRecord.findMany).not.toHaveBeenCalled();
    });
  });
});
