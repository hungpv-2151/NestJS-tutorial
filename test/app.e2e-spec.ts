import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app-bootstrap.js';
import { PrismaService } from './../src/database/prisma.service.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ isReady: vi.fn().mockResolvedValue(true), onModuleDestroy: vi.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('/api/health/readiness (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health/readiness')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('returns the API validation envelope for an over-bound limit', () => {
    return request(app.getHttpServer())
      .get('/api/health/readiness?limit=101')
      .expect(422)
      .expect({ errors: { limit: ['must not be greater than 100'] } });
  });

  afterEach(async () => {
    await app.close();
  });
});
