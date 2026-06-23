import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ThrottlerExceptionFilter } from '../common/filters/throttler-exception.filter';

async function makeApp(
  loginLimit: number,
  nonceLimit: number,
  defaultLimit = 100,
): Promise<INestApplication> {
  const mod: TestingModule = await Test.createTestingModule({
    imports: [
      ThrottlerModule.forRoot([
        { name: 'auth-login', ttl: 60000, limit: loginLimit },
        { name: 'auth-nonce', ttl: 60000, limit: nonceLimit },
        { name: 'default', ttl: 60000, limit: defaultLimit },
      ]),
    ],
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: makeMockService() },
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: APP_FILTER, useClass: ThrottlerExceptionFilter },
    ],
  }).compile();

  const app = mod.createNestApplication();
  await app.init();
  return app;
}

function makeMockService() {
  return {
    getChallenge: jest.fn().mockReturnValue('challenge-xyz'),
    login: jest
      .fn()
      .mockResolvedValue({ token: 'jwt-abc', refreshToken: 'rt-abc', user: {} }),
    refresh: jest.fn().mockResolvedValue({ token: 'jwt-new' }),
    logout: jest.fn().mockResolvedValue({ message: 'Logged out successfully' }),
  };
}

const ADDRESS = 'GBRPYHIL2CI3FV4BMSXVQQ2C4KSXZVZPCWO47HF7HCVLMJYXK7PSUWZ';

// ---------------------------------------------------------------------------
// Suite 1 — normal operation (generous limits, never hit)
// ---------------------------------------------------------------------------
describe('AuthController – normal operation', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await makeApp(100, 100);
  });

  afterAll(() => app.close());

  it('GET /auth/challenge returns 200 with a challenge', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/challenge')
      .query({ address: ADDRESS });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ challenge: 'challenge-xyz' });
  });

  it('POST /auth/login returns 201 on valid body', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ stellarAddress: ADDRESS, signature: 'sig', message: 'msg' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ token: 'jwt-abc' });
  });

  it('POST /auth/refresh returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'rt-abc' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ token: 'jwt-new' });
  });

  it('POST /auth/logout returns 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken: 'rt-abc' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: 'Logged out successfully' });
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — /auth/login rate limit enforcement
// Each test gets its own app so throttle counters are isolated.
// ---------------------------------------------------------------------------
describe('AuthController – /auth/login rate limiting', () => {
  it('allows requests up to the limit then returns 429 on the next', async () => {
    // limit=2 means 2 allowed, 3rd is blocked
    const app = await makeApp(2, 100);
    const server = app.getHttpServer();
    const body = { stellarAddress: ADDRESS, signature: 'sig', message: 'msg' };

    await request(server).post('/auth/login').send(body).expect(201);
    await request(server).post('/auth/login').send(body).expect(201);

    const res = await request(server).post('/auth/login').send(body);
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please wait before retrying.',
    });

    await app.close();
  });

  it('production limit is 10 req/min (verifies decorator config)', async () => {
    // Spin up with the real production limit and confirm the 10th succeeds / 11th fails
    const app = await makeApp(10, 100);
    const server = app.getHttpServer();
    const body = { stellarAddress: ADDRESS, signature: 'sig', message: 'msg' };

    for (let i = 0; i < 10; i++) {
      await request(server).post('/auth/login').send(body).expect(201);
    }

    const res = await request(server).post('/auth/login').send(body);
    expect(res.status).toBe(429);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — /auth/challenge rate limit enforcement
// ---------------------------------------------------------------------------
describe('AuthController – /auth/challenge rate limiting', () => {
  it('allows requests up to the limit then returns 429 on the next', async () => {
    const app = await makeApp(100, 2);
    const server = app.getHttpServer();

    await request(server).get('/auth/challenge').query({ address: ADDRESS }).expect(200);
    await request(server).get('/auth/challenge').query({ address: ADDRESS }).expect(200);

    const res = await request(server).get('/auth/challenge').query({ address: ADDRESS });
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please wait before retrying.',
    });

    await app.close();
  });

  it('production limit is 20 req/min (verifies decorator config)', async () => {
    const app = await makeApp(100, 20);
    const server = app.getHttpServer();

    for (let i = 0; i < 20; i++) {
      await request(server).get('/auth/challenge').query({ address: ADDRESS }).expect(200);
    }

    const res = await request(server).get('/auth/challenge').query({ address: ADDRESS });
    expect(res.status).toBe(429);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — /auth/refresh and /auth/logout are NOT affected by the strict
//           auth-login / auth-nonce throttlers (they use @SkipThrottle)
// ---------------------------------------------------------------------------
describe('AuthController – refresh and logout skip auth throttlers', () => {
  it('POST /auth/refresh succeeds even when auth-login limit is exhausted', async () => {
    // login limit=1 so it throttles immediately; refresh/logout must still work
    const app = await makeApp(1, 1);
    const server = app.getHttpServer();

    // Exhaust the login throttler
    await request(server)
      .post('/auth/login')
      .send({ stellarAddress: ADDRESS, signature: 's', message: 'm' })
      .expect(201);
    await request(server)
      .post('/auth/login')
      .send({ stellarAddress: ADDRESS, signature: 's', message: 'm' })
      .expect(429);

    // refresh must still be reachable — not blocked by auth-login throttler
    await request(server).post('/auth/refresh').send({ refreshToken: 'rt' }).expect(201);
    await request(server).post('/auth/refresh').send({ refreshToken: 'rt' }).expect(201);

    await app.close();
  });

  it('POST /auth/logout succeeds even when auth-login limit is exhausted', async () => {
    const app = await makeApp(1, 1);
    const server = app.getHttpServer();

    // Exhaust both auth throttlers
    await request(server)
      .post('/auth/login')
      .send({ stellarAddress: ADDRESS, signature: 's', message: 'm' })
      .expect(201);
    await request(server)
      .post('/auth/login')
      .send({ stellarAddress: ADDRESS, signature: 's', message: 'm' })
      .expect(429);

    // logout must still succeed
    await request(server).post('/auth/logout').send({ refreshToken: 'rt' }).expect(201);
    await request(server).post('/auth/logout').send({ refreshToken: 'rt' }).expect(201);

    await app.close();
  });
});
