import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { DataSource, In } from 'typeorm';

import { Article } from '../src/articles/article.entity.js';
import { ArticleFavorite } from '../src/articles/article-favorite.entity.js';
import { UserFollow } from '../src/profiles/user-follow.entity.js';
import { createApp } from '../src/create-app.js';
import {
  authenticateAs,
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

describe('GET /api/articles/feed (e2e)', () => {
  let app: INestApplication;
  let fixture: ArticleFixture | undefined;
  let extraSlugs: string[] = [];

  afterEach(async () => {
    try {
      if (app && extraSlugs.length) {
        await app.get(DataSource).getRepository(Article).delete({ slug: In(extraSlugs) });
      }
      if (app && fixture) await cleanArticleFixture(app.get(DataSource), fixture);
    } finally {
      await app?.close();
      fixture = undefined;
      extraSlugs = [];
    }
  });

  it('serves feed without shadowing the existing article detail route', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    authenticateAs(app, fixture.viewerUsername);

    const response = await request(app.getHttpServer())
      .get('/api/articles/feed')
      .set('Authorization', 'Token test-token')
      .expect(200);
    expect(response.body).toEqual({ articles: [], articlesCount: 0 });
  });

  it('returns only followed authors with a body-free, personalized page', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    const dataSource = app.get(DataSource);
    await dataSource.getRepository(UserFollow).insert({
      followerId: fixture.viewerId,
      followingId: fixture.authorId,
    });
    await dataSource.getRepository(ArticleFavorite).insert({
      articleId: fixture.articleId,
      userId: fixture.viewerId,
    });
    const extras = [1, 2].map((index) => ({
      slug: `feed-article-${index}-${fixture!.slug}`,
      title: `Followed article ${index}`,
      description: 'Feed pagination fixture',
      body: 'Private body',
      authorId: fixture!.authorId,
    }));
    extraSlugs = extras.map(({ slug }) => slug);
    await dataSource.getRepository(Article).save(extras);
    authenticateAs(app, fixture.viewerUsername);

    const response = await request(app.getHttpServer())
      .get('/api/articles/feed')
      .set('Authorization', 'Token test-token')
      .expect(200);
    expect(response.body.articlesCount).toBe(3);
    expect(response.body.articles).toHaveLength(3);
    const original = response.body.articles.find((article: { slug: string }) => article.slug === fixture!.slug);
    expect(original).toMatchObject({
      tagList: fixture.tags, favorited: true, favoritesCount: 1,
      author: { username: fixture.authorUsername, following: true },
    });
    expect(original).not.toHaveProperty('body');
    expect(original.author).not.toHaveProperty('email');
    expect(original.author).not.toHaveProperty('passwordHash');
    expect(response.headers['cache-control']).toBe('private, no-store');

    const page = await request(app.getHttpServer()).get('/api/articles/feed?limit=1&offset=1')
      .set('Authorization', 'Token test-token').expect(200);
    expect(page.body.articlesCount).toBe(3);
    expect(page.body.articles).toHaveLength(1);
    expect(page.body.articles[0].slug).not.toBe(response.body.articles[0].slug);
    const maximum = await request(app.getHttpServer()).get('/api/articles/feed?limit=100')
      .set('Authorization', 'Token test-token').expect(200);
    expect(maximum.body.articles).toHaveLength(3);
    const pastEnd = await request(app.getHttpServer()).get('/api/articles/feed?offset=3')
      .set('Authorization', 'Token test-token').expect(200);
    expect(pastEnd.body).toEqual({ articles: [], articlesCount: 3 });
  });

  it('documents the feed auth, pagination, responses, and response schema', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    const response = await request(app.getHttpServer()).get('/docs-json').expect(200);
    const operation = response.body.paths['/api/articles/feed'].get;
    expect(operation.parameters.map(({ name }: { name: string }) => name).sort()).toEqual([
      'limit', 'offset',
    ]);
    expect(operation.security).toEqual([{ tokenAuth: [] }]);
    const params = Object.fromEntries(operation.parameters.map((parameter: { name: string }) => [parameter.name, parameter]));
    expect(params.offset.schema).toMatchObject({ minimum: 0, default: 0 });
    expect(params.limit.schema).toMatchObject({ minimum: 1, maximum: 100, default: 20 });
    expect(operation.responses).toEqual(expect.objectContaining({
      '200': expect.any(Object), '401': expect.any(Object), '422': expect.any(Object), '500': expect.any(Object),
    }));
    const itemSchema = operation.responses['200'].content['application/json']
      .schema.properties.articles.items;
    expect(itemSchema.properties).toHaveProperty('author');
    expect(itemSchema.properties).not.toHaveProperty('body');
  });

  it('keeps the existing article detail route available', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    const detail = await request(app.getHttpServer())
      .get(`/api/articles/${fixture.slug}`)
      .expect(200);
    expect(detail.body.article.body).toBe('Detail body');
  });
});
