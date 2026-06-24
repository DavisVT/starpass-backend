import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../common/prisma.service';
import { StellarService } from '../stellar/stellar.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('HealthController', () => {
  let controller: HealthController;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };
  const mockStellarService = {
    getLatestLedger: jest.fn(),
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
      mockStellarService.getLatestLedger.mockResolvedValueOnce(12345);

      const result = await controller.getDeepHealth();
      expect(result).toEqual({
        status: 'ok',
        dependencies: {
          database: 'up',
          stellar: 'up',
        },
      });
    });

    it('should throw ServiceUnavailableException when DB is down', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('DB Down'));
      mockStellarService.getLatestLedger.mockResolvedValueOnce(12345);

      await expect(controller.getDeepHealth()).rejects.toThrow(
        ServiceUnavailableException,
      );

      try {
        await controller.getDeepHealth();
      } catch (error: any) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect(error.getResponse()).toEqual({
          status: 'error',
          dependencies: {
            database: 'down',
            stellar: 'up',
          },
        });
      }
    });

    it('should throw ServiceUnavailableException when Stellar is down', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([1]);
      mockStellarService.getLatestLedger.mockRejectedValueOnce(new Error('Stellar Down'));

      await expect(controller.getDeepHealth()).rejects.toThrow(
        ServiceUnavailableException,
      );

      try {
        await controller.getDeepHealth();
      } catch (error: any) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect(error.getResponse()).toEqual({
          status: 'error',
          dependencies: {
            database: 'up',
            stellar: 'down',
          },
        });
      }
    });

    it('should throw ServiceUnavailableException when both are down', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('DB Down'));
      mockStellarService.getLatestLedger.mockRejectedValueOnce(new Error('Stellar Down'));

      await expect(controller.getDeepHealth()).rejects.toThrow(
        ServiceUnavailableException,
      );

      try {
        await controller.getDeepHealth();
      } catch (error: any) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect(error.getResponse()).toEqual({
          status: 'error',
          dependencies: {
            database: 'down',
            stellar: 'down',
          },
        });
      }
    });
  });
});
