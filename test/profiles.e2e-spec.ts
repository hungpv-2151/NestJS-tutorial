import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app-bootstrap.js';
import { PrismaService } from '../src/database/prisma.service.js';

const prefix = `e2e_profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

describe('profiles (live e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await app.close();
  });

  it('serves anonymous and authenticated profile serializers', async () => {
    const user = { username: `${prefix}_reader`, email: `${prefix}_reader@example.com`, password: 'correct horse battery staple' };
    const registered = await request(app.getHttpServer()).post('/api/users').send({ user }).expect(201);
    const anonymous = await request(app.getHttpServer()).get(`/api/profiles/${user.username}`).expect(200);
    expect(anonymous.body).toEqual({ profile: { username: user.username, bio: null, image: null, following: false } });
    const authenticated = await request(app.getHttpServer()).get(`/api/profiles/${user.username}`).set('Authorization', `Token ${registered.body.user.token}`).expect(200);
    expect(authenticated.body.profile.following).toBe(false);
  });

  it('returns 404 for an unknown profile', async () => {
    await request(app.getHttpServer()).get(`/api/profiles/${prefix}_missing`).expect(404).expect({ errors: { profile: ['not found'] } });
  });
});
