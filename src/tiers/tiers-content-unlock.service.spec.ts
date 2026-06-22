import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TiersService } from './tiers.service';
import { PrismaService } from '../common/prisma.service';

describe('TiersService – content unlock', () => {
  let service: TiersService;

  const TIER_ID = 'tier-uuid';
  const FAN_ADDRESS = 'GB_FAN';
  const SECRET = 'test-secret';

  const mockPrisma = {
    creator: { findUnique: jest.fn() },
    tier: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
    fan: { findUnique: jest.fn() },
    pass: { findFirst: jest.fn() },
  };

  const mockConfig = { get: jest.fn().mockReturnValue(SECRET) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TiersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<TiersService>(TiersService);
    jest.clearAllMocks();
    mockConfig.get.mockReturnValue(SECRET);
  });

  describe('unlockContent', () => {
    it('returns a signed token for a valid pass holder', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue({ id: TIER_ID });
      mockPrisma.fan.findUnique.mockResolvedValue({ id: 'fan-id', stellarAddress: FAN_ADDRESS });
      mockPrisma.pass.findFirst.mockResolvedValue({ id: 'pass-id' });

      const result = await service.unlockContent(TIER_ID, FAN_ADDRESS);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresAt');
      expect(typeof result.token).toBe('string');
      // token should contain a dot separator (payload.sig)
      expect(result.token).toMatch(/^[A-Za-z0-9_-]+\.[0-9a-f]{64}$/);
    });

    it('throws NotFoundException when tier does not exist', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue(null);

      await expect(service.unlockContent('bad-tier', FAN_ADDRESS)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when fan has no pass', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue({ id: TIER_ID });
      mockPrisma.fan.findUnique.mockResolvedValue({ id: 'fan-id', stellarAddress: FAN_ADDRESS });
      mockPrisma.pass.findFirst.mockResolvedValue(null);

      await expect(service.unlockContent(TIER_ID, FAN_ADDRESS)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when fan does not exist in DB', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue({ id: TIER_ID });
      mockPrisma.fan.findUnique.mockResolvedValue(null);

      await expect(service.unlockContent(TIER_ID, FAN_ADDRESS)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('verifyContentToken', () => {
    async function issueToken(): Promise<string> {
      mockPrisma.tier.findUnique.mockResolvedValue({ id: TIER_ID });
      mockPrisma.fan.findUnique.mockResolvedValue({ id: 'fan-id' });
      mockPrisma.pass.findFirst.mockResolvedValue({ id: 'pass-id' });
      const { token } = await service.unlockContent(TIER_ID, FAN_ADDRESS);
      return token;
    }

    it('returns valid=true and fanAddress for a fresh token', async () => {
      const token = await issueToken();
      jest.clearAllMocks();

      const result = service.verifyContentToken(TIER_ID, token);

      expect(result.valid).toBe(true);
      expect(result.fanAddress).toBe(FAN_ADDRESS);
    });

    it('returns valid=false for a tampered signature', async () => {
      const token = await issueToken();
      const tampered = token.slice(0, -4) + 'aaaa';

      expect(service.verifyContentToken(TIER_ID, tampered)).toEqual({ valid: false });
    });

    it('returns valid=false for the wrong tier ID', async () => {
      const token = await issueToken();

      expect(service.verifyContentToken('other-tier', token)).toEqual({ valid: false });
    });

    it('returns valid=false for an expired token', () => {
      // Build a token manually with an already-past expiry
      const expiresAt = Math.floor(Date.now() / 1000) - 1; // 1 second in the past
      const payload = `${TIER_ID}:${FAN_ADDRESS}:${expiresAt}`;
      const { createHmac } = require('crypto');
      const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
      const token = `${Buffer.from(payload).toString('base64url')}.${sig}`;

      expect(service.verifyContentToken(TIER_ID, token)).toEqual({ valid: false });
    });

    it('returns valid=false for a malformed token', () => {
      expect(service.verifyContentToken(TIER_ID, 'not-a-real-token')).toEqual({ valid: false });
    });
  });
});
