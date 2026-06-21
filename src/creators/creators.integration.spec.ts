import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { CreatorsModule } from './creators.module';
import { CreatorsService } from './creators.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

describe('Creators GET /creators/:id/revenue Integration', () => {
  let app: INestApplication;

  const mockRevenueResult = {
    totalRevenue: 15450.0,
    totalPasses: 342,
    pendingBalance: 1200.5,
    topTiers: [
      { id: 'tier-123', name: 'VIP Access', revenue: 8500.0 },
      { id: 'tier-456', name: 'Early Bird', revenue: 5000.0 },
      { id: 'tier-789', name: 'Base Tier', revenue: 1949.5 },
    ],
  };

  const mockCreatorsService = {
    getRevenue: jest.fn().mockResolvedValue(mockRevenueResult),
  };

  const successJwtGuard = {
    canActivate: (context: any) => {
      const request = context.switchToHttp().getRequest();
      request.user = { sub: 'user-123' };
      return true;
    },
  };

  const mismatchJwtGuard = {
    canActivate: (context: any) => {
      const request = context.switchToHttp().getRequest();
      request.user = { sub: 'user-456' };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CreatorsModule],
    })
      .overrideProvider(CreatorsService)
      .useValue(mockCreatorsService)
      .overrideProvider(JwtAuthGuard)
      .useValue(successJwtGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return creator revenue analytics when the authenticated user owns the creator', async () => {
    await request(app.getHttpServer())
      .get('/creators/user-123/revenue')
      .expect(200)
      .expect(mockRevenueResult);

    expect(mockCreatorsService.getRevenue).toHaveBeenCalledWith('user-123');
  });

  it('should return 403 when the authenticated user does not own the creator', async () => {
    // Rebuild the application with a guard that returns a different authenticated user
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CreatorsModule],
    })
      .overrideProvider(CreatorsService)
      .useValue(mockCreatorsService)
      .overrideProvider(JwtAuthGuard)
      .useValue(mismatchJwtGuard)
      .compile();

    const localApp = moduleFixture.createNestApplication();
    await localApp.init();

    await request(localApp.getHttpServer())
      .get('/creators/user-123/revenue')
      .expect(403);

    await localApp.close();
  });
});
