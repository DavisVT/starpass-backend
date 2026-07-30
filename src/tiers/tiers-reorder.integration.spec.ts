import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import * as request from 'supertest';
import { CreatorsModule } from '../creators/creators.module';
import { TiersModule } from './tiers.module';
import { PrismaService } from '../common/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

describe('PATCH /v1/creators/:id/tiers/order Integration', () => {
  const CREATOR_ID = 'creator-uuid-1';
  const USER_ID = 'creator-uuid-1'; // req.user.sub is matched against :id
  const OTHER_USER_ID = 'user-uuid-2';

  // Existing tiers with numeric onChainIds
  const mockTiers = [
    { id: 'tier-uuid-a', creatorId: CREATOR_ID, onChainId: 1, sortOrder: 0 },
    { id: 'tier-uuid-b', creatorId: CREATOR_ID, onChainId: 2, sortOrder: 1 },
    { id: 'tier-uuid-c', creatorId: CREATOR_ID, onChainId: 3, sortOrder: 2 },
  ];

  const reorderedTiers = [
    { id: 'tier-uuid-c', creatorId: CREATOR_ID, onChainId: 3, sortOrder: 0 },
    { id: 'tier-uuid-a', creatorId: CREATOR_ID, onChainId: 1, sortOrder: 1 },
    { id: 'tier-uuid-b', creatorId: CREATOR_ID, onChainId: 2, sortOrder: 2 },
  ];

  const mockPrisma = {
    creator: { findUnique: jest.fn() },
    tier: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    webhookConfig: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
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
    mockPrisma.$transaction.mockImplementation(async (ops: any[]) => {
      await Promise.all(ops);
    });
    mockPrisma.tier.update.mockResolvedValue({});
  });

  it('successful reorder returns tiers in new order', async () => {
    const app = await buildApp(ownerGuard);

    // First call: existing tiers for validation; second call: final sorted result
    mockPrisma.tier.findMany
      .mockResolvedValueOnce(mockTiers)
      .mockResolvedValueOnce(reorderedTiers);

    const res = await request(app.getHttpServer())
      .patch(`/v1/creators/${CREATOR_ID}/tiers/order`)
      .send({ tierIds: [3, 1, 2] })
      .expect(200);

    expect(res.body).toEqual(reorderedTiers);

    await app.close();
  });

  it('non-owner creator gets 403', async () => {
    const app = await buildApp(otherUserGuard);

    await request(app.getHttpServer())
      .patch(`/v1/creators/${CREATOR_ID}/tiers/order`)
      .send({ tierIds: [3, 1, 2] })
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
      .patch(`/v1/creators/${CREATOR_ID}/tiers/order`)
      .send({ tierIds: [3, 1, 2] })
      .expect(401);

    await app.close();
  });

  it('request with a tier id not belonging to the creator returns 400', async () => {
    const app = await buildApp(ownerGuard);

    // Existing tiers have onChainIds [1, 2, 3]; input includes 99 which is foreign
    mockPrisma.tier.findMany.mockResolvedValueOnce(mockTiers);

    await request(app.getHttpServer())
      .patch(`/v1/creators/${CREATOR_ID}/tiers/order`)
      .send({ tierIds: [1, 2, 99] })
      .expect(400);

    await app.close();
  });

  it("request missing one of the creator's existing tier ids returns 400", async () => {
    const app = await buildApp(ownerGuard);

    // Existing tiers have onChainIds [1, 2, 3]; input only provides 2 ids
    mockPrisma.tier.findMany.mockResolvedValueOnce(mockTiers);

    await request(app.getHttpServer())
      .patch(`/v1/creators/${CREATOR_ID}/tiers/order`)
      .send({ tierIds: [1, 2] })
      .expect(400);

    await app.close();
  });
});
