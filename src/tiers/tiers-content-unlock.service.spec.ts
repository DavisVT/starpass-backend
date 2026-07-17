import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TiersService } from './tiers.service';
import { PrismaService } from '../common/prisma.service';
import { CryptoService } from '../common/crypto.service';

describe('TiersService – content unlock', () => {
  let service: TiersService;

  const TIER_ID = 'tier-uuid';
  const FAN_ADDRESS = 'GB_FAN';
  const SECRET = 'test-secret';
  const CREATOR_ADDRESS = 'G_CREATOR';
  const TEST_SERVER_MASTER_KEY = 'a'.repeat(64);
  const TEST_SERVER_X25519_KEY = 'b'.repeat(64);

  const mockCryptoService = {
    generateAes256GcmKey: jest.fn().mockReturnValue(Buffer.from('c'.repeat(64), 'hex')),
    encryptKeyWithMasterKey: jest.fn().mockReturnValue('encrypted-key'),
    decryptKeyWithMasterKey: jest.fn().mockReturnValue(Buffer.from('c'.repeat(64), 'hex')),
    encryptWithAes256Gcm: jest.fn().mockReturnValue({ 
      ciphertext: Buffer.from('encrypted-content'), 
      iv: Buffer.from('iv'), 
      authTag: Buffer.from('tag') 
    }),
    getRawEd25519PublicKeyFromStellarAddress: jest.fn().mockReturnValue(Buffer.from('fan-pub-key')),
    wrapKeyWithFanPublicKey: jest.fn().mockReturnValue({ 
      wrappedKey: 'wrapped-key', 
      serverPublicKey: 'server-pub-key', 
      nonce: 'nonce' 
    }),
  };

  const mockPrisma = {
    creator: { findUnique: jest.fn() },
    tier: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn(), create: jest.fn() },
    fan: { findUnique: jest.fn() },
    pass: { findFirst: jest.fn() },
    tierContentKey: { 
      findFirst: jest.fn(), 
      create: jest.fn(), 
      update: jest.fn() 
    },
    tierContent: { create: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (fn) => {
      return await fn(mockPrisma);
    }),
  };

  const mockConfig = { get: jest.fn().mockImplementation((key: string) => {
    if (key === 'CONTENT_URL_SECRET') return SECRET;
    if (key === 'SERVER_MASTER_KEY') return TEST_SERVER_MASTER_KEY;
    if (key === 'SERVER_X25519_PRIVATE_KEY') return TEST_SERVER_X25519_KEY;
    return undefined;
  }) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TiersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: CryptoService, useValue: mockCryptoService },
      ],
    }).compile();

    service = module.get<TiersService>(TiersService);
    jest.clearAllMocks();
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'CONTENT_URL_SECRET') return SECRET;
      if (key === 'SERVER_MASTER_KEY') return TEST_SERVER_MASTER_KEY;
      if (key === 'SERVER_X25519_PRIVATE_KEY') return TEST_SERVER_X25519_KEY;
      return undefined;
    });
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
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createHmac } = require('crypto');
      const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
      const token = `${Buffer.from(payload).toString('base64url')}.${sig}`;

      expect(service.verifyContentToken(TIER_ID, token)).toEqual({ valid: false });
    });

    it('returns valid=false for a malformed token', () => {
      expect(service.verifyContentToken(TIER_ID, 'not-a-real-token')).toEqual({ valid: false });
    });
  });

  describe('createTierContent', () => {
    it('should create encrypted content for a tier', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue({ 
        id: TIER_ID, 
        creatorId: 'creator-id',
        creator: { stellarAddress: CREATOR_ADDRESS } 
      });
      mockPrisma.tierContentKey.findFirst.mockResolvedValue({ id: 'content-key-id', keyVersion: 1 });
      mockPrisma.tierContent.create.mockResolvedValue({ id: 'content-id' });

      const result = await service.createTierContent(TIER_ID, CREATOR_ADDRESS, { content: 'Test content' });
      
      expect(result).toEqual({ id: 'content-id' });
    });

    it('should throw NotFoundException if tier does not exist', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue(null);
      await expect(service.createTierContent(TIER_ID, CREATOR_ADDRESS, { content: 'Test' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw ForbiddenException if not tier owner', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue({ 
        id: TIER_ID, 
        creatorId: 'creator-id',
        creator: { stellarAddress: 'OTHER_CREATOR' } 
      });
      await expect(service.createTierContent(TIER_ID, CREATOR_ADDRESS, { content: 'Test' })).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getFanEncryptedContentKey', () => {
    it('should return wrapped key for valid pass holders', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue({ id: TIER_ID });
      mockPrisma.fan.findUnique.mockResolvedValue({ id: 'fan-id' });
      mockPrisma.pass.findFirst.mockResolvedValue({ id: 'pass-id' });
      mockPrisma.tierContentKey.findFirst.mockResolvedValue({ id: 'key-id', keyVersion: 1 });
      mockPrisma.tierContent.findFirst.mockResolvedValue({ id: 'content-id' });

      const result = await service.getFanEncryptedContentKey(TIER_ID, FAN_ADDRESS);
      
      expect(result).toHaveProperty('wrappedKey');
      expect(result).toHaveProperty('keyVersion');
      expect(result).toHaveProperty('content');
    });

    it('should throw NotFoundException when tier not found', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue(null);
      await expect(service.getFanEncryptedContentKey(TIER_ID, FAN_ADDRESS)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should throw ForbiddenException when no valid pass', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue({ id: TIER_ID });
      mockPrisma.fan.findUnique.mockResolvedValue({ id: 'fan-id' });
      mockPrisma.pass.findFirst.mockResolvedValue(null);

      await expect(service.getFanEncryptedContentKey(TIER_ID, FAN_ADDRESS)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('rotateTierContentKey', () => {
    it('should rotate key and increment version', async () => {
      mockPrisma.tier.findUnique.mockResolvedValue({ 
        id: TIER_ID, 
        creatorId: 'creator-id',
        creator: { stellarAddress: CREATOR_ADDRESS } 
      });
      mockPrisma.tierContentKey.findFirst.mockResolvedValue({ id: 'old-key-id', keyVersion: 1 });
      mockPrisma.tierContentKey.create.mockResolvedValue({ id: 'new-key-id', keyVersion: 2 });
      
      const result = await service.rotateTierContentKey(TIER_ID, CREATOR_ADDRESS);
      
      expect(result.keyVersion).toBe(2);
    });
  });
});
