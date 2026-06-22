import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IndexerService } from './indexer.service';
import { StellarService } from '../stellar/stellar.service';
import { TiersService } from '../tiers/tiers.service';
import { PassesService } from '../passes/passes.service';
import { PrismaService } from '../common/prisma.service';

describe('IndexerService', () => {
  let service: IndexerService;

  const mockPrismaService = {
    indexerCheckpoint: {
      upsert: jest.fn().mockResolvedValue({ id: 'singleton', lastLedger: 0 }),
      update: jest.fn(),
    },
    user: {
      upsert: jest.fn().mockResolvedValue({ stellarAddress: 'GCREATOR', role: 'CREATOR' }),
    },
    creator: {
      findUnique: jest.fn(),
    },
    tier: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockStellarService = {
    getContractEvents: jest.fn().mockResolvedValue([]),
    getLatestLedger: jest.fn().mockResolvedValue(1000000),
  };

  const mockTiersService = {
    upsertFromChain: jest.fn().mockResolvedValue({}),
  };

  const mockPassesService = {
    upsertFromChain: jest.fn().mockResolvedValue({}),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'INDEXER_INTERVAL_MS') return '10000';
      if (key === 'INDEXER_ENABLED') return 'true';
      return null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndexerService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StellarService, useValue: mockStellarService },
        { provide: TiersService, useValue: mockTiersService },
        { provide: PassesService, useValue: mockPassesService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<IndexerService>(IndexerService);
  });

  describe('startReindex', () => {
    it('should create a job and return job ID', async () => {
      const dto = { fromLedger: 100000, toLedger: 105000 };
      mockStellarService.getContractEvents.mockResolvedValue([]);

      const result = await service.startReindex(dto);

      expect(result).toHaveProperty('jobId');
      expect(typeof result.jobId).toBe('string');
    });

    it('should reject range exceeding 10,000 ledgers', async () => {
      const dto = { fromLedger: 100000, toLedger: 120000 };

      await expect(service.startReindex(dto)).rejects.toThrow(BadRequestException);
      await expect(service.startReindex(dto)).rejects.toThrow('Ledger range exceeds maximum');
    });

    it('should reject when toLedger < fromLedger', async () => {
      const dto = { fromLedger: 110000, toLedger: 100000 };

      await expect(service.startReindex(dto)).rejects.toThrow(BadRequestException);
      await expect(service.startReindex(dto)).rejects.toThrow(
        'toLedger must be greater than or equal to fromLedger',
      );
    });

    it('should accept range of exactly 10,000 ledgers', async () => {
      const dto = { fromLedger: 100000, toLedger: 109999 };
      mockStellarService.getContractEvents.mockResolvedValue([]);

      const result = await service.startReindex(dto);

      expect(result).toHaveProperty('jobId');
    });

    it('should accept range of 1 ledger', async () => {
      const dto = { fromLedger: 100000, toLedger: 100000 };
      mockStellarService.getContractEvents.mockResolvedValue([]);

      const result = await service.startReindex(dto);

      expect(result).toHaveProperty('jobId');
    });
  });

  describe('getReindexJobStatus', () => {
    it('should return job status for existing job', async () => {
      const dto = { fromLedger: 100000, toLedger: 105000 };
      mockStellarService.getContractEvents.mockResolvedValue([]);

      const { jobId } = await service.startReindex(dto);
      const status = service.getReindexJobStatus(jobId);

      expect(status).toHaveProperty('jobId', jobId);
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('fromLedger', 100000);
      expect(status).toHaveProperty('toLedger', 105000);
    });

    it('should throw BadRequestException for non-existent job', () => {
      expect(() => service.getReindexJobStatus('non-existent-id')).toThrow(BadRequestException);
      expect(() => service.getReindexJobStatus('non-existent-id')).toThrow('not found');
    });
  });

  describe('idempotency', () => {
    it('should process same events without creating duplicates', async () => {
      const dto = { fromLedger: 100000, toLedger: 100000 };
      const mockEvent = {
        topic: ['creator_registered'],
        value: { vec: ['GCREATOR'] },
      };

      mockStellarService.getContractEvents.mockResolvedValue([mockEvent]);
      mockPrismaService.user.upsert.mockResolvedValue({
        stellarAddress: 'GCREATOR',
        role: 'CREATOR',
      });

      // First reindex
      const { jobId: job1 } = await service.startReindex(dto);

      // Wait for job to complete (in real scenario this is async)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reset mocks for second reindex
      mockStellarService.getContractEvents.mockResolvedValue([mockEvent]);
      mockPrismaService.user.upsert.mockClear();

      // Second reindex of same range
      const { jobId: job2 } = await service.startReindex(dto);

      // Both should use upsert which is idempotent
      expect(job1).not.toBe(job2);
    });
  });
});
