import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import request from 'supertest';
import { configureApp } from '../src/app-bootstrap.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

const prefix = `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const password = 'correct horse battery staple';

describe('contract edge cases', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await app.close();
  });

  async function register(suffix: string) {
    const user = { username: `${prefix}_${suffix}`, email: `${prefix}_${suffix}@example.com`, password };
    return (await request(app.getHttpServer()).post('/api/users').send({ user }).expect(201)).body.user;
  }

  it('rejects supplied invalid tokens on public routes and requires the private feed token', async () => {
    const user = await register('token');
    await request(app.getHttpServer()).get(`/api/profiles/${user.username}`).set('Authorization', 'Token invalid.token.value').expect(401).expect({ errors: { token: ['is invalid'] } });
    await request(app.getHttpServer()).get('/api/articles').set('Authorization', 'Token invalid.token.value').expect(401).expect({ errors: { token: ['is invalid'] } });
    await request(app.getHttpServer()).get('/api/articles/feed').expect(401).expect({ errors: { token: ['is missing'] } });
  });

  it('keeps repeated follow and favorite requests idempotent', async () => {
    const follower = await register('follower');
    const author = await register('author');
    const token = { Authorization: `Token ${follower.token}` };
    await request(app.getHttpServer()).post(`/api/profiles/${author.username}/follow`).set(token).expect(200);
    await request(app.getHttpServer()).post(`/api/profiles/${author.username}/follow`).set(token).expect(200).expect(({ body }) => expect(body.profile.following).toBe(true));
    const created = await request(app.getHttpServer()).post('/api/articles').set('Authorization', `Token ${author.token}`).send({ article: { title: `${prefix} article`, description: 'edge case', body: 'body' } }).expect(201);
    await request(app.getHttpServer()).post(`/api/articles/${created.body.article.slug}/favorite`).set(token).expect(200);
    await request(app.getHttpServer()).post(`/api/articles/${created.body.article.slug}/favorite`).set(token).expect(200).expect(({ body }) => expect(body.article.favoritesCount).toBe(1));
  });
});
