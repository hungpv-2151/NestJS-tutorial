import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app-bootstrap.js';
import { PrismaService } from '../src/database/prisma.service.js';

const prefix = `e2e_article_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const password = 'correct horse battery staple';

describe('articles (live e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: { token: string; username: string };
  let other: { token: string; username: string };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    owner = await register('owner');
    other = await register('other');
  });

  afterAll(async () => {
    await prisma.article.deleteMany({ where: { author: { username: { startsWith: prefix } } } });
    await prisma.tag.deleteMany({ where: { name: { startsWith: prefix } } });
    await prisma.user.deleteMany({ where: { username: { startsWith: prefix } } });
    await app.close();
  });

  async function register(suffix: string): Promise<{ token: string; username: string }> {
    const user = { username: `${prefix}_${suffix}`, email: `${prefix}_${suffix}@example.com`, password };
    const response = await request(app.getHttpServer()).post('/api/users').send({ user }).expect(201);
    return { token: response.body.user.token, username: user.username };
  }

  async function create(title: string, tags: string[] = [`${prefix}_tag`]): Promise<any> {
    const response = await request(app.getHttpServer()).post('/api/articles').set('Authorization', `Token ${owner.token}`).send({ article: { title, description: 'description', body: 'body', tagList: tags } }).expect(201);
    return response.body.article;
  }

  it('creates detail, lists without body, and preserves ordered tags', async () => {
    const article = await create(`${prefix} first`, [`${prefix}_z`, `${prefix}_a`]);
    expect(article.body).toBe('body');
    expect(article.tagList).toEqual([`${prefix}_z`, `${prefix}_a`]);
    expect(article).toMatchObject({ favorited: false, favoritesCount: 0 });
    const list = await request(app.getHttpServer()).get('/api/articles').query({ author: owner.username }).expect(200);
    expect(list.body.articlesCount).toBeGreaterThanOrEqual(1);
    expect(list.body.articles[0]).not.toHaveProperty('body');
    const detail = await request(app.getHttpServer()).get(`/api/articles/${article.slug}`).expect(200);
    expect(detail.body.article.body).toBe('body');
  });

  it('filters by tag and author and returns stable offset pages', async () => {
    await create(`${prefix} page one`, [`${prefix}_filter`]);
    await create(`${prefix} page two`, [`${prefix}_filter`]);
    const filtered = await request(app.getHttpServer()).get('/api/articles').query({ tag: `${prefix}_filter`, author: owner.username, limit: 1, offset: 0 }).expect(200);
    const next = await request(app.getHttpServer()).get('/api/articles').query({ tag: `${prefix}_filter`, author: owner.username, limit: 1, offset: 1 }).expect(200);
    expect(filtered.body.articlesCount).toBe(2);
    expect(filtered.body.articles[0].slug).not.toBe(next.body.articles[0].slug);
  });

  it('updates tags, rejects null tags, and enforces ownership', async () => {
    const article = await create(`${prefix} update`, [`${prefix}_keep`]);
    const renamed = await request(app.getHttpServer()).put(`/api/articles/${article.slug}`).set('Authorization', `Token ${owner.token}`).send({ article: { title: `${prefix} renamed` } }).expect(200).expect(({ body }) => expect(body.article.tagList).toEqual([`${prefix}_keep`]));
    const slug = renamed.body.article.slug;
    await request(app.getHttpServer()).put(`/api/articles/${slug}`).set('Authorization', `Token ${owner.token}`).send({ article: { tagList: null } }).expect(422);
    await request(app.getHttpServer()).put(`/api/articles/${slug}`).set('Authorization', `Token ${other.token}`).send({ article: { title: 'hijack' } }).expect(403);
    await request(app.getHttpServer()).delete(`/api/articles/${slug}`).set('Authorization', `Token ${other.token}`).expect(403);
    const clearable = await create(`${prefix} clear tags`, [`${prefix}_clear`]);
    await request(app.getHttpServer()).put(`/api/articles/${clearable.slug}`).set('Authorization', `Token ${owner.token}`).send({ article: { tagList: [] } }).expect(200).expect(({ body }) => expect(body.article.tagList).toEqual([]));
  });

  it('maps unknown articles and invalid article input', async () => {
    await request(app.getHttpServer()).get(`/api/articles/${prefix}_missing`).expect(404).expect({ errors: { article: ['not found'] } });
    await request(app.getHttpServer()).post('/api/articles').set('Authorization', `Token ${owner.token}`).send({ article: { title: '', description: 'x', body: 'x' } }).expect(422);
  });

  it('generates distinct bounded slugs for repeated titles', async () => {
    const title = `${prefix} repeated title`;
    const [first, second] = await Promise.all([create(title, []), create(title, [])]);
    expect(first.slug).not.toBe(second.slug);
    expect(second.slug).toMatch(new RegExp(`^${prefix.replaceAll('_', '-')}-repeated-title(?:-[a-f0-9-]+)?$`));
  });

  it('maps zero-row update and delete operations after removal', async () => {
    const article = await create(`${prefix} removed`, []);
    await request(app.getHttpServer()).delete(`/api/articles/${article.slug}`).set('Authorization', `Token ${owner.token}`).expect(204);
    await request(app.getHttpServer()).put(`/api/articles/${article.slug}`).set('Authorization', `Token ${owner.token}`).send({ article: { title: 'late update' } }).expect(404);
    await request(app.getHttpServer()).delete(`/api/articles/${article.slug}`).set('Authorization', `Token ${owner.token}`).expect(404);
  });
});
