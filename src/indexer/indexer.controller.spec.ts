import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { IndexerController } from './indexer.controller';
import { IndexerService } from './indexer.service';
import { ReindexDto } from './dto/reindex.dto';
import { AdminApiKeyGuard } from '../admin/admin-api-key.guard';

describe('IndexerController', () => {
  let controller: IndexerController;
  let service: IndexerService;

  const mockIndexerService = {
    startReindex: jest.fn(),
    getReindexJobStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IndexerController],
      providers: [{ provide: IndexerService, useValue: mockIndexerService }],
    })
      .overrideGuard(AdminApiKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<IndexerController>(IndexerController);
    service = module.get<IndexerService>(IndexerService);

    jest.clearAllMocks();
  });

  describe('POST /indexer/reindex', () => {
    it('should start a reindex job and return 202 with job ID', async () => {
      const dto: ReindexDto = { fromLedger: 100000, toLedger: 105000 };
      mockIndexerService.startReindex.mockResolvedValue({ jobId: 'test-job-id' });

      const result = await controller.startReindex(dto);

      expect(service.startReindex).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        jobId: 'test-job-id',
        status: 'pending',
        message: 'Reindex job started successfully',
      });
    });

    it('should reject ranges exceeding 10,000 ledgers', async () => {
      const dto: ReindexDto = { fromLedger: 100000, toLedger: 120000 };
      mockIndexerService.startReindex.mockRejectedValue(
        new BadRequestException('Ledger range exceeds maximum of 10000'),
      );

      await expect(controller.startReindex(dto)).rejects.toThrow(BadRequestException);
      await expect(controller.startReindex(dto)).rejects.toThrow('Ledger range exceeds maximum');
    });

    it('should reject invalid range where toLedger < fromLedger', async () => {
      const dto: ReindexDto = { fromLedger: 110000, toLedger: 100000 };
      mockIndexerService.startReindex.mockRejectedValue(
        new BadRequestException('toLedger must be greater than or equal to fromLedger'),
      );

      await expect(controller.startReindex(dto)).rejects.toThrow(BadRequestException);
    });

    it('should accept range of exactly 10,000 ledgers', async () => {
      const dto: ReindexDto = { fromLedger: 100000, toLedger: 109999 };
      mockIndexerService.startReindex.mockResolvedValue({ jobId: 'test-job-id' });

      const result = await controller.startReindex(dto);

      expect(result.jobId).toBe('test-job-id');
    });
  });

  describe('GET /indexer/reindex/:jobId', () => {
    it('should return job status for valid job ID', async () => {
      const mockStatus = {
        jobId: 'test-job-id',
        status: 'completed' as const,
        fromLedger: 100000,
        toLedger: 105000,
        eventsProcessed: 50,
        createdAt: new Date(),
        completedAt: new Date(),
      };
      mockIndexerService.getReindexJobStatus.mockReturnValue(mockStatus);

      const result = await controller.getReindexStatus('test-job-id');

      expect(service.getReindexJobStatus).toHaveBeenCalledWith('test-job-id');
      expect(result).toEqual(mockStatus);
    });

    it('should throw BadRequestException for non-existent job ID', async () => {
      mockIndexerService.getReindexJobStatus.mockImplementation(() => {
        throw new BadRequestException('Reindex job non-existent not found');
      });

      await expect(controller.getReindexStatus('non-existent')).rejects.toThrow(BadRequestException);
    });

    it('should return running status for in-progress job', async () => {
      const mockStatus = {
        jobId: 'test-job-id',
        status: 'running' as const,
        fromLedger: 100000,
        toLedger: 105000,
        eventsProcessed: 25,
        createdAt: new Date(),
      };
      mockIndexerService.getReindexJobStatus.mockReturnValue(mockStatus);

      const result = await controller.getReindexStatus('test-job-id');

      expect(result.status).toBe('running');
    });

    it('should return failed status with error message', async () => {
      const mockStatus = {
        jobId: 'test-job-id',
        status: 'failed' as const,
        fromLedger: 100000,
        toLedger: 105000,
        eventsProcessed: 10,
        error: 'Connection timeout',
        createdAt: new Date(),
        completedAt: new Date(),
      };
      mockIndexerService.getReindexJobStatus.mockReturnValue(mockStatus);

      const result = await controller.getReindexStatus('test-job-id');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Connection timeout');
    });
  });

  describe('Admin-only access', () => {
    it('should be protected by AdminApiKeyGuard', () => {
      const guards = Reflect.getMetadata('__guards__', IndexerController);
      expect(guards).toBeDefined();
      expect(guards.some((guard: any) => guard === AdminApiKeyGuard)).toBe(true);
    });
  });
});
