import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from '../admin/admin.module';

import { PrismaService } from '../common/prisma.service';
import { AdminApiKeyGuard } from '../admin/admin-api-key.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

describe('Featured Creators', () => {
  let app: INestApplication;

  const mockCreators = [
    { id: 'c1', userId: 'u1', stellarAddress: 'addr1', displayName: 'Alice', bio: null, avatarUrl: null, totalEarned: '0', featured: true, featuredOrder: 2, registeredAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
    { id: 'c2', userId: 'u2', stellarAddress: 'addr2', displayName: 'Bob', bio: null, avatarUrl: null, totalEarned: '0', featured: true, featuredOrder: 1, registeredAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
    { id: 'c3', userId: 'u3', stellarAddress: 'addr3', displayName: 'Charlie', bio: null, avatarUrl: null, totalEarned: '0', featured: false, featuredOrder: 0, registeredAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
  ];

  const mockPrisma = {
    creator: {
      findUnique: jest.fn(({ where: { id } }: any) => mockCreators.find(c => c.id === id) ?? null),
      update: jest.fn(({ where: { id }, data }: any) => {
        const c = mockCreators.find(c => c.id === id);
        return Promise.resolve(c ? { ...c, ...data } : null);
      }),
      findMany: jest.fn(({ where, orderBy }: any) => {
        let filtered = [...mockCreators];
        if (where?.featured === true) {
          filtered = filtered.filter(c => c.featured);
        }
        if (orderBy?.featuredOrder === 'asc') {
          filtered.sort((a, b) => a.featuredOrder - b.featuredOrder);
        }
        return Promise.resolve(filtered);
      }),
    },
    fan: { count: jest.fn().mockResolvedValue(0) },
    pass: { count: jest.fn().mockResolvedValue(0) },
    user: { count: jest.fn().mockResolvedValue(0) },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  const mockGuard = { canActivate: () => true };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }), AdminModule, CreatorsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideGuard(AdminApiKeyGuard)
      .useValue(mockGuard)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /admin/creators/:id/feature', () => {
    it('should feature a creator with given order', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/creators/c3/feature')
        .send({ order: 3 })
        .expect(201);

      expect(res.body.featured).toBe(true);
      expect(res.body.featuredOrder).toBe(3);
    });

    it('should reject invalid order', async () => {
      await request(app.getHttpServer())
        .post('/admin/creators/c1/feature')
        .send({ order: -1 })
        .expect(400);
    });

    it('should return 404 for non-existent creator', async () => {
      await request(app.getHttpServer())
        .post('/admin/creators/nonexistent/feature')
        .send({ order: 1 })
        .expect(404);
    });
  });

  describe('DELETE /admin/creators/:id/feature', () => {
    it('should unfeature a creator', async () => {
      const res = await request(app.getHttpServer())
        .delete('/admin/creators/c1/feature')
        .expect(200);

      expect(res.body.featured).toBe(false);
    });

    it('should return 404 for non-existent creator', async () => {
      await request(app.getHttpServer())
        .delete('/admin/creators/nonexistent/feature')
        .expect(404);
    });
  });

  describe('GET /creators/featured', () => {
    it('should return featured creators in order', async () => {
      const res = await request(app.getHttpServer())
        .get('/creators/featured')
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0].displayName).toBe('Bob');
      expect(res.body[1].displayName).toBe('Alice');
    });

    it('should not include non-featured creators', async () => {
      const res = await request(app.getHttpServer())
        .get('/creators/featured')
        .expect(200);

      expect(res.body.every((c: any) => c.featured)).toBe(true);
    });
  });
});