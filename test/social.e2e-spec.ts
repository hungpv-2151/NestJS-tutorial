import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app-bootstrap.js';
import { PrismaService } from '../src/database/prisma.service.js';

const prefix = `e2e_social_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const password = 'correct horse battery staple';

describe('social actions and feed (live e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let main: { username: string; token: string };
  let author: { username: string; token: string };
  let other: { username: string; token: string };
  let authorArticles: string[] = [];

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    main = await register('main');
    author = await register('author');
    other = await register('other');
    authorArticles = [await createArticle('first'), await createArticle('second')];
  });

  afterAll(async () => {
    await prisma.article.deleteMany({ where: { author: { username: { startsWith: prefix } } } });
    await prisma.follow.deleteMany({ where: { follower: { username: { startsWith: prefix } } } });
    await prisma.favorite.deleteMany({ where: { user: { username: { startsWith: prefix } } } });
    await prisma.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await app.close();
  });

  async function register(suffix: string): Promise<{ username: string; token: string }> {
    const user = { username: `${prefix}_${suffix}`, email: `${prefix}_${suffix}@example.com`, password };
    const response = await request(app.getHttpServer()).post('/api/users').send({ user }).expect(201);
    return { username: user.username, token: response.body.user.token };
  }

  async function createArticle(suffix: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/api/articles').set('Authorization', `Token ${author.token}`).send({ article: { title: `${prefix} ${suffix}`, description: 'feed article', body: 'feed body' } }).expect(201);
    return response.body.article.slug;
  }

  it('follows and unfollows idempotently, with self and unknown errors', async () => {
    await request(app.getHttpServer()).post(`/api/profiles/${author.username}/follow`).set('Authorization', `Token ${main.token}`).expect(200).expect(({ body }) => expect(body.profile.following).toBe(true));
    await request(app.getHttpServer()).post(`/api/profiles/${author.username}/follow`).set('Authorization', `Token ${main.token}`).expect(200);
    await request(app.getHttpServer()).get(`/api/profiles/${author.username}`).set('Authorization', `Token ${main.token}`).expect(200).expect(({ body }) => expect(body.profile.following).toBe(true));
    await request(app.getHttpServer()).delete(`/api/profiles/${author.username}/follow`).set('Authorization', `Token ${main.token}`).expect(200).expect(({ body }) => expect(body.profile.following).toBe(false));
    await request(app.getHttpServer()).delete(`/api/profiles/${author.username}/follow`).set('Authorization', `Token ${main.token}`).expect(200);
    await request(app.getHttpServer()).post(`/api/profiles/${main.username}/follow`).set('Authorization', `Token ${main.token}`).expect(422);
    await request(app.getHttpServer()).post(`/api/profiles/${prefix}_missing/follow`).set('Authorization', `Token ${main.token}`).expect(404);
  });

  it('favorites and unfavorites idempotently while maintaining count', async () => {
    const slug = authorArticles[0];
    await request(app.getHttpServer()).post(`/api/articles/${slug}/favorite`).set('Authorization', `Token ${main.token}`).expect(200).expect(({ body }) => expect(body.article).toMatchObject({ favorited: true, favoritesCount: 1 }));
    await request(app.getHttpServer()).post(`/api/articles/${slug}/favorite`).set('Authorization', `Token ${main.token}`).expect(200).expect(({ body }) => expect(body.article.favoritesCount).toBe(1));
    await request(app.getHttpServer()).get(`/api/articles/${slug}`).set('Authorization', `Token ${main.token}`).expect(200).expect(({ body }) => expect(body.article).toMatchObject({ favorited: true, favoritesCount: 1 }));
    await request(app.getHttpServer()).delete(`/api/articles/${slug}/favorite`).set('Authorization', `Token ${main.token}`).expect(200).expect(({ body }) => expect(body.article).toMatchObject({ favorited: false, favoritesCount: 0 }));
    await request(app.getHttpServer()).delete(`/api/articles/${slug}/favorite`).set('Authorization', `Token ${main.token}`).expect(200);
    await request(app.getHttpServer()).post(`/api/articles/${prefix}_missing/favorite`).set('Authorization', `Token ${main.token}`).expect(404);
  });

  it('requires JWT for paginated feed and returns followed author articles', async () => {
    await request(app.getHttpServer()).get('/api/articles/feed').expect(401);
    await request(app.getHttpServer()).post(`/api/profiles/${author.username}/follow`).set('Authorization', `Token ${main.token}`).expect(200);
    const feed = await request(app.getHttpServer()).get('/api/articles/feed').set('Authorization', `Token ${main.token}`).query({ limit: 1 }).expect(200);
    expect(feed.body.articlesCount).toBe(2);
    expect(feed.body.articles).toHaveLength(1);
    expect(feed.body.articles[0]).not.toHaveProperty('body');
    expect(feed.body.articles[0].author.username).toBe(author.username);
    expect(feed.body.articles[0].author.following).toBe(true);
    const next = await request(app.getHttpServer()).get('/api/articles/feed').set('Authorization', `Token ${main.token}`).query({ limit: 1, offset: 1 }).expect(200);
    expect(next.body.articlesCount).toBe(2);
    expect(next.body.articles[0].slug).not.toBe(feed.body.articles[0].slug);
    await request(app.getHttpServer()).delete(`/api/profiles/${author.username}/follow`).set('Authorization', `Token ${main.token}`).expect(200);
    await request(app.getHttpServer()).get('/api/articles/feed').set('Authorization', `Token ${other.token}`).expect(200).expect(({ body }) => expect(body.articlesCount).toBe(0));
  });

  it('maps unfollow after target removal to profile not found', async () => {
    await request(app.getHttpServer()).post(`/api/profiles/${other.username}/follow`).set('Authorization', `Token ${main.token}`).expect(200);
    await prisma.user.delete({ where: { username: other.username } });
    await request(app.getHttpServer()).delete(`/api/profiles/${other.username}/follow`).set('Authorization', `Token ${main.token}`).expect(404);
  });

  it('maps favorite after article removal to article not found', async () => {
    const slug = authorArticles[1];
    await prisma.article.delete({ where: { slug } });
    await request(app.getHttpServer()).post(`/api/articles/${slug}/favorite`).set('Authorization', `Token ${main.token}`).expect(404);
  });
});
