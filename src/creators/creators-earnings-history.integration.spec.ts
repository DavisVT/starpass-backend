import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import * as request from 'supertest';
import { CreatorsModule } from './creators.module';
import { TiersModule } from '../tiers/tiers.module';
import { PrismaService } from '../common/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationsGateway } from '../notifications/notifications.gateway';

describe('GET /v1/creators/:id/earnings-history Integration', () => {
  const CREATOR_ID = 'creator-uuid-1';
  const USER_ID = 'creator-uuid-1'; // req.user.sub matched against :id
  const OTHER_USER_ID = 'user-uuid-2';

  const mockRecords = [
    {
      id: 'rec-1',
      creatorId: CREATOR_ID,
      fanId: 'fan-uuid',
      tierId: 'tier-uuid',
      amount: 25,
      fee: 0,
      netAmount: 25,
      createdAt: new Date('2026-06-10T12:00:00Z'),
    },
  ];

  const mockPrisma = {
    creator: { findUnique: jest.fn() },
    tier: { findMany: jest.fn().mockResolvedValue([]) },
    earningsRecord: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    webhookConfig: { findMany: jest.fn().mockResolvedValue([]) },
    pass: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
  };

  const mockNotificationsGateway = {
    emitNewTierEvent: jest.fn(),
    emitPassExpiringSoonEvent: jest.fn(),
    bulkCreateForFans: jest.fn(),
  };

  const ownerGuard = {
    canActivate: (context: any) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: USER_ID };
      return true;
    },
  };

  const otherUserGuard = {
    canActivate: (context: any) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: OTHER_USER_ID };
      return true;
    },
  };

  async function buildApp(guardOverride: object) {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        CreatorsModule,
        TiersModule,
        CacheModule.register({ isGlobal: true }),
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(NotificationsGateway)
      .useValue(mockNotificationsGateway)
      .overrideGuard(JwtAuthGuard)
      .useValue(guardOverride)
      .compile();

    const app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    return app;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.creator.findUnique.mockResolvedValue({ id: CREATOR_ID, userId: USER_ID });
    mockPrisma.earningsRecord.findMany.mockResolvedValue(mockRecords);
    mockPrisma.earningsRecord.count.mockResolvedValue(1);
  });

  it('non-owner creator gets 403', async () => {
    const app = await buildApp(otherUserGuard);

    await request(app.getHttpServer())
      .get(`/creators/${CREATOR_ID}/earnings-history`)
      .expect(403);

    await app.close();
  });

  it('unauthenticated request gets 401', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        CreatorsModule,
        TiersModule,
        CacheModule.register({ isGlobal: true }),
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(NotificationsGateway)
      .useValue(mockNotificationsGateway)
      .compile();

    const app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    await request(app.getHttpServer())
      .get(`/creators/${CREATOR_ID}/earnings-history`)
      .expect(401);

    await app.close();
  });
});
