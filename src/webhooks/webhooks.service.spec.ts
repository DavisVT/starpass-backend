import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../common/prisma.service';
import { NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prisma: PrismaService;

  const mockPrismaService = {
    creator: {
      findUnique: jest.fn(),
    },
    webhookConfig: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should successfully register a webhook for a creator', async () => {
      const creatorId = 'creator-123';
      const url = 'https://example.com/webhook';
      const secret = 'supersecret';

      mockPrismaService.creator.findUnique.mockResolvedValue({ id: creatorId });
      mockPrismaService.webhookConfig.create.mockResolvedValue({
        id: 'webhook-123',
        creatorId,
        url,
        secret,
        active: true,
      });

      const result = await service.register(creatorId, url, secret);

      expect(prisma.creator.findUnique).toHaveBeenCalledWith({
        where: { id: creatorId },
      });
      expect(prisma.webhookConfig.create).toHaveBeenCalledWith({
        data: { creatorId, url, secret },
      });
      expect(result).toEqual(
        expect.objectContaining({ id: 'webhook-123', creatorId, url, secret })
      );
    });

    it('should throw NotFoundException if creator does not exist', async () => {
      const creatorId = 'non-existent';
      mockPrismaService.creator.findUnique.mockResolvedValue(null);

      await expect(
        service.register(creatorId, 'https://example.com', 'secret')
      ).rejects.toThrow(NotFoundException);

      expect(prisma.webhookConfig.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should successfully remove a webhook', async () => {
      const creatorId = 'creator-123';
      const webhookId = 'webhook-123';

      mockPrismaService.webhookConfig.findFirst.mockResolvedValue({
        id: webhookId,
        creatorId,
      });
      mockPrismaService.webhookConfig.delete.mockResolvedValue({
        id: webhookId,
      });

      const result = await service.remove(creatorId, webhookId);

      expect(prisma.webhookConfig.findFirst).toHaveBeenCalledWith({
        where: { id: webhookId, creatorId },
      });
      expect(prisma.webhookConfig.delete).toHaveBeenCalledWith({
        where: { id: webhookId },
      });
      expect(result).toEqual({ id: webhookId });
    });

    it('should throw NotFoundException if webhook does not exist for the creator', async () => {
      mockPrismaService.webhookConfig.findFirst.mockResolvedValue(null);

      await expect(service.remove('creator-123', 'webhook-123')).rejects.toThrow(
        NotFoundException
      );

      expect(prisma.webhookConfig.delete).not.toHaveBeenCalled();
    });
  });

  describe('deliverPassPurchaseWebhook', () => {
    let fetchMock: jest.SpyInstance;

    beforeEach(() => {
      fetchMock = jest.spyOn(global, 'fetch').mockImplementation();
    });

    afterEach(() => {
      fetchMock.mockRestore();
    });

    it('should deliver signed payload to registered active webhooks', async () => {
      const creatorId = 'creator-123';
      const passData = {
        id: 'pass-123',
        onChainId: BigInt(456),
        creatorId,
        expiresAt: new Date().toISOString(),
      };

      const webhook = {
        id: 'webhook-123',
        url: 'https://example.com/webhook',
        secret: 'webhook-secret',
        active: true,
      };

      mockPrismaService.webhookConfig.findMany.mockResolvedValue([webhook]);
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as any);

      await service.deliverPassPurchaseWebhook(creatorId, passData);

      const expectedPayload = JSON.stringify(passData, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );
      const expectedSignature = crypto
        .createHmac('sha256', webhook.secret)
        .update(expectedPayload)
        .digest('hex');

      expect(prisma.webhookConfig.findMany).toHaveBeenCalledWith({
        where: { creatorId, active: true },
      });
      expect(fetchMock).toHaveBeenCalledWith(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': expectedSignature,
        },
        body: expectedPayload,
      });
    });

    it('should skip delivery if no active webhooks found', async () => {
      mockPrismaService.webhookConfig.findMany.mockResolvedValue([]);

      await service.deliverPassPurchaseWebhook('creator-123', {});

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should handle delivery failure gracefully (no crash)', async () => {
      const creatorId = 'creator-123';
      const webhook = {
        id: 'webhook-123',
        url: 'https://example.com/webhook',
        secret: 'webhook-secret',
        active: true,
      };

      mockPrismaService.webhookConfig.findMany.mockResolvedValue([webhook]);
      fetchMock.mockRejectedValue(new Error('Network error'));

      // This should not throw an exception
      await expect(
        service.deliverPassPurchaseWebhook(creatorId, { id: 'pass-123' })
      ).resolves.not.toThrow();

      expect(fetchMock).toHaveBeenCalled();
    });

    it('should handle non-ok HTTP response status gracefully (no crash)', async () => {
      const creatorId = 'creator-123';
      const webhook = {
        id: 'webhook-123',
        url: 'https://example.com/webhook',
        secret: 'webhook-secret',
        active: true,
      };

      mockPrismaService.webhookConfig.findMany.mockResolvedValue([webhook]);
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as any);

      // This should not throw an exception
      await expect(
        service.deliverPassPurchaseWebhook(creatorId, { id: 'pass-123' })
      ).resolves.not.toThrow();

      expect(fetchMock).toHaveBeenCalled();
    });
  });
});
