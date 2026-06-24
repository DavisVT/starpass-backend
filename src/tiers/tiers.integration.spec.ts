import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TiersModule } from './tiers.module';
import { PrismaService } from '../common/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

describe('Tiers GET /tiers/:id/analytics Integration', () => {
  const TIER_ID = 'tier-uuid-1';
  const mockTier = {
    id: TIER_ID,
    creatorId: 'creator-1',
    priceUsdc: '10.00',
    creator: { id: 'creator-1', userId: 'user-123' },
  };

  const mockPurchases = [
    { purchasedAt: new Date('2026-06-10T12:00:00Z') },
    { purchasedAt: new Date('2026-06-12T08:00:00Z') },
    { purchasedAt: new Date('2026-05-01T00:00:00Z') },
  ];

  const mockPrisma = {
    tier: {
      findUnique: jest.fn().mockResolvedValue(mockTier),
    },
    pass: {
      findMany: jest.fn().mockResolvedValue(mockPurchases),
      count: jest.fn().mockResolvedValue(2),
    },
  };

  const ownerJwtGuard = {
    canActivate: (context: any) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: 'user-123' };
      return true;
    },
  };

  const otherUserJwtGuard = {
    canActivate: (context: any) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: 'user-456' };
      return true;
    },
  };

  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TiersModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideGuard(JwtAuthGuard)
      .useValue(ownerJwtGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.tier.findUnique.mockResolvedValue(mockTier);
    mockPrisma.pass.findMany.mockResolvedValue(mockPurchases);
    mockPrisma.pass.count.mockResolvedValue(2);
  });

  it('should return tier analytics with all required fields for 30d (default)', async () => {
    jest.useFakeTimers({ now: new Date('2026-06-15T12:00:00Z') });

    const res = await request(app.getHttpServer())
      .get(`/tiers/${TIER_ID}/analytics`)
      .expect(200);

    expect(res.body).toMatchObject({
      totalPurchases: expect.any(Number),
      totalRevenue: expect.any(Number),
      activePasses: expect.any(Number),
      purchasesByDay: expect.any(Array),
    });
    expect(res.body.purchasesByDay).toHaveLength(30);
    expect(res.body.purchasesByDay[0]).toMatchObject({
      date: expect.any(String),
      count: expect.any(Number),
    });

    jest.useRealTimers();
  });

  it('should filter analytics for 7d period', async () => {
    jest.useFakeTimers({ now: new Date('2026-06-15T12:00:00Z') });

    const res = await request(app.getHttpServer())
      .get(`/tiers/${TIER_ID}/analytics?period=7d`)
      .expect(200);

    expect(res.body.purchasesByDay).toHaveLength(7);
    expect(mockPrisma.pass.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tierId: TIER_ID,
          purchasedAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );

    jest.useRealTimers();
  });

  it('should filter analytics for 90d period', async () => {
    jest.useFakeTimers({ now: new Date('2026-06-15T12:00:00Z') });

    const res = await request(app.getHttpServer())
      .get(`/tiers/${TIER_ID}/analytics?period=90d`)
      .expect(200);

    expect(res.body.purchasesByDay).toHaveLength(90);

    jest.useRealTimers();
  });

  it('should return 403 when the authenticated user is not the tier creator', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TiersModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideGuard(JwtAuthGuard)
      .useValue(otherUserJwtGuard)
      .compile();

    const localApp = moduleFixture.createNestApplication();
    await localApp.init();

    await request(localApp.getHttpServer())
      .get(`/tiers/${TIER_ID}/analytics?period=30d`)
      .expect(403);

    await localApp.close();
  });

  it('should return 401 when no auth token is provided', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TiersModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    const localApp = moduleFixture.createNestApplication();
    await localApp.init();

    await request(localApp.getHttpServer())
      .get(`/tiers/${TIER_ID}/analytics?period=30d`)
      .expect(401);

    await localApp.close();
  });
});
