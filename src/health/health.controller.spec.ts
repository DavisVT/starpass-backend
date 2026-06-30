import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../common/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import { MetricsService } from '../metrics/metrics.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('HealthController', () => {
  let controller: HealthController;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
    getSlowQueryCount: jest.fn(),
    getConnectionPoolMetrics: jest.fn(),
  };
  const mockStellarService = {
    getLatestLedger: jest.fn(),
  };
  const mockMetricsService = {
    setDbQueryLatency: jest.fn(),
    setDbConnectionPoolUtilization: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: StellarService,
          useValue: mockStellarService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /health (liveness)', () => {
    it('should return 200 with status ok', () => {
      const result = controller.getLiveness();
      expect(result).toEqual({ status: 'ok' });
    });
  });

  describe('GET /health/ready (readiness)', () => {
    it('should return 200 with status ok when DB is reachable', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([1]);

      const result = await controller.getReadiness();
      expect(result).toEqual({ status: 'ok' });
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
    });

    it('should throw ServiceUnavailableException when DB is unreachable', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('Connection failure'));

      await expect(controller.getReadiness()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('GET /health/deep (deep health)', () => {
    it('should return 200 with ok status and dependencies up when all are healthy', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([1]);
      mockPrismaService.getSlowQueryCount.mockReturnValueOnce(0);
      mockPrismaService.getConnectionPoolMetrics.mockReturnValueOnce({
        activeConnections: 1,
        maxConnections: 10,
        utilizationPercent: 10,
      });
      mockStellarService.getLatestLedger.mockResolvedValueOnce(12345);

      const result = await controller.getDeepHealth();
      expect(result).toEqual({
        status: 'ok',
        dependencies: {
          database: {
            status: 'up',
            latencyMs: expect.any(Number),
            slowQueries: 0,
            connectionPool: {
              activeConnections: 1,
              maxConnections: 10,
              utilizationPercent: 10,
            },
          },
          stellar: 'up',
        },
      });
      expect(mockMetricsService.setDbQueryLatency).toHaveBeenCalled();
      expect(mockMetricsService.setDbConnectionPoolUtilization).toHaveBeenCalledWith(10);
    });

    it('should throw ServiceUnavailableException when DB is down', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('DB Down'));
      mockStellarService.getLatestLedger.mockResolvedValueOnce(12345);

      let error: any;
      try {
        await controller.getDeepHealth();
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      const response = error.getResponse();
      expect(response.status).toEqual('error');
      expect(response.dependencies.database.status).toEqual('down');
      expect(response.dependencies.stellar).toEqual('up');
    });

    it('should throw ServiceUnavailableException when Stellar is down', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([1]);
      mockPrismaService.getSlowQueryCount.mockReturnValueOnce(0);
      mockPrismaService.getConnectionPoolMetrics.mockReturnValueOnce({
        activeConnections: 1,
        maxConnections: 10,
        utilizationPercent: 10,
      });
      mockStellarService.getLatestLedger.mockRejectedValueOnce(new Error('Stellar Down'));

      let error: any;
      try {
        await controller.getDeepHealth();
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      const response = error.getResponse();
      expect(response.status).toEqual('error');
      expect(response.dependencies.database.status).toEqual('up');
      expect(response.dependencies.stellar).toEqual('down');
    });

    it('should throw ServiceUnavailableException when both are down', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('DB Down'));
      mockStellarService.getLatestLedger.mockRejectedValueOnce(new Error('Stellar Down'));

      let error: any;
      try {
        await controller.getDeepHealth();
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      const response = error.getResponse();
      expect(response.status).toEqual('error');
      expect(response.dependencies.database.status).toEqual('down');
      expect(response.dependencies.stellar).toEqual('down');
    });

    it('should report slow query count in deep health check', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([1]);
      mockPrismaService.getSlowQueryCount.mockReturnValueOnce(5);
      mockPrismaService.getConnectionPoolMetrics.mockReturnValueOnce({
        activeConnections: 1,
        maxConnections: 10,
        utilizationPercent: 10,
      });
      mockStellarService.getLatestLedger.mockResolvedValueOnce(12345);

      const result = await controller.getDeepHealth();
      expect(result.dependencies.database.slowQueries).toEqual(5);
    });

    it('should report connection pool metrics in deep health check', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([1]);
      mockPrismaService.getSlowQueryCount.mockReturnValueOnce(0);
      mockPrismaService.getConnectionPoolMetrics.mockReturnValueOnce({
        activeConnections: 5,
        maxConnections: 10,
        utilizationPercent: 50,
      });
      mockStellarService.getLatestLedger.mockResolvedValueOnce(12345);

      const result = await controller.getDeepHealth();
      expect(result.dependencies.database.connectionPool).toEqual({
        activeConnections: 5,
        maxConnections: 10,
        utilizationPercent: 50,
      });
    });

    it('should log warning when connection pool utilization exceeds 80%', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockPrismaService.$queryRaw.mockResolvedValueOnce([1]);
      mockPrismaService.getSlowQueryCount.mockReturnValueOnce(0);
      mockPrismaService.getConnectionPoolMetrics.mockReturnValueOnce({
        activeConnections: 9,
        maxConnections: 10,
        utilizationPercent: 90,
      });
      mockStellarService.getLatestLedger.mockResolvedValueOnce(12345);

      await controller.getDeepHealth();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('High database connection pool utilization: 90.00%'),
      );
      consoleWarnSpy.mockRestore();
    });
  });
});
