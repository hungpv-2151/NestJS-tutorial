import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app-bootstrap.js';
import { PrismaService } from '../src/database/prisma.service.js';

const prefix = `e2e_comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const password = 'correct horse battery staple';

describe('comments (live e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: { token: string; username: string };
  let commenter: { token: string; username: string };
  let other: { token: string; username: string };
  let slug: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    owner = await register('owner');
    commenter = await register('commenter');
    other = await register('other');
    const article = await request(app.getHttpServer()).post('/api/articles').set('Authorization', `Token ${owner.token}`).send({ article: { title: `${prefix} article`, description: 'comments', body: 'body' } }).expect(201);
    slug = article.body.article.slug;
  });

  afterAll(async () => {
    await prisma.article.deleteMany({ where: { author: { username: { startsWith: prefix } } } });
    await prisma.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await app.close();
  });

  async function register(suffix: string): Promise<{ username: string; token: string }> {
    const user = { username: `${prefix}_${suffix}`, email: `${prefix}_${suffix}@example.com`, password };
    const response = await request(app.getHttpServer()).post('/api/users').send({ user }).expect(201);
    return { username: user.username, token: response.body.user.token };
  }

  it('lists publicly and creates comments with author serialization', async () => {
    await request(app.getHttpServer()).get(`/api/articles/${slug}/comments`).expect(200).expect({ comments: [] });
    const created = await request(app.getHttpServer()).post(`/api/articles/${slug}/comments`).set('Authorization', `Token ${commenter.token}`).send({ comment: { body: 'first comment' } }).expect(201);
    expect(created.body.comment).toMatchObject({ body: 'first comment', author: { username: commenter.username, following: false } });
    await request(app.getHttpServer()).get(`/api/articles/${slug}/comments`).expect(200).expect(({ body }) => {
      expect(body.comments).toHaveLength(1);
      expect(body.comments[0].id).toBe(created.body.comment.id);
    });
  });

  it('enforces scoped comment deletion and preserves non-owner data', async () => {
    const first = await request(app.getHttpServer()).post(`/api/articles/${slug}/comments`).set('Authorization', `Token ${commenter.token}`).send({ comment: { body: 'owned comment' } }).expect(201);
    const id = first.body.comment.id;
    await request(app.getHttpServer()).delete(`/api/articles/${slug}/comments/${id}`).set('Authorization', `Token ${other.token}`).expect(403);
    await request(app.getHttpServer()).get(`/api/articles/${slug}/comments`).expect(200).expect(({ body }) => expect(body.comments.some((comment: { id: number }) => comment.id === id)).toBe(true));
    await request(app.getHttpServer()).delete(`/api/articles/${slug}/comments/${id}`).set('Authorization', `Token ${commenter.token}`).expect(204);
    await request(app.getHttpServer()).delete(`/api/articles/${slug}/comments/${id}`).set('Authorization', `Token ${commenter.token}`).expect(404);
  });

  it('maps comment wrapper and resource validation errors', async () => {
    await request(app.getHttpServer()).post(`/api/articles/${slug}/comments`).set('Authorization', `Token ${commenter.token}`).send({}).expect(422);
    await request(app.getHttpServer()).post(`/api/articles/${slug}/comments`).set('Authorization', `Token ${commenter.token}`).send({ comment: { body: '' } }).expect(422);
    await request(app.getHttpServer()).get(`/api/articles/${prefix}_missing/comments`).expect(404);
    await request(app.getHttpServer()).post(`/api/articles/${prefix}_missing/comments`).set('Authorization', `Token ${commenter.token}`).send({ comment: { body: 'missing' } }).expect(404);
    await request(app.getHttpServer()).delete(`/api/articles/${prefix}_missing/comments/1`).set('Authorization', `Token ${commenter.token}`).expect(404);
  });
});
