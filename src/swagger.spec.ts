import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { PrismaService } from './common/prisma.service';

describe('Swagger Documentation', () => {
  let app: INestApplication;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalEnv;
    if (app) {
      await app.close();
    }
  });

  it('should serve Swagger UI at /api/docs in non-production environment', async () => {
    process.env.NODE_ENV = 'development';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();

    // Mimic the Swagger configuration logic in main.ts
    if (process.env.NODE_ENV !== 'production') {
      const config = new DocumentBuilder()
        .setTitle('StarPass API')
        .setDescription('Backend API for the StarPass creator membership platform on Stellar')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document);
    }

    await app.init();

    const response = await request(app.getHttpServer())
      .get('/api/docs/')
      .expect(200);

    expect(response.text).toContain('<div id="swagger-ui">');
  });

  it('should not serve Swagger UI at /api/docs in production environment', async () => {
    process.env.NODE_ENV = 'production';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();

    // Mimic the Swagger configuration logic in main.ts
    if (process.env.NODE_ENV !== 'production') {
      const config = new DocumentBuilder()
        .setTitle('StarPass API')
        .setDescription('Backend API for the StarPass creator membership platform on Stellar')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document);
    }

    await app.init();

    await request(app.getHttpServer())
      .get('/api/docs/')
      .expect(404);
  });
});
