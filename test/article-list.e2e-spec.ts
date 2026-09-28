import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';

import { ArticleFavorite } from '../src/articles/article-favorite.entity.js';
import { UserFollow } from '../src/profiles/user-follow.entity.js';
import { createApp } from '../src/create-app.js';
import {
  authenticateAs,
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

describe('GET /api/articles (e2e)', () => {
  let app: INestApplication;
  let fixture: ArticleFixture | undefined;

  afterEach(async () => {
    try {
      if (app && fixture) await cleanArticleFixture(app.get(DataSource), fixture);
    } finally {
      await app?.close();
      fixture = undefined;
    }
  });

  it('returns the default page to a guest without leaking body or private author fields', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));

    const response = await request(app.getHttpServer())
      .get('/api/articles')
      .query({ author: fixture.authorUsername })
      .expect(200);

    expect(response.body.articlesCount).toBe(1);
    expect(response.body.articles).toHaveLength(response.body.articlesCount);
    const article = response.body.articles.find(
      (item: { slug: string }) => item.slug === fixture?.slug,
    );
    expect(article).toMatchObject({
      slug: fixture.slug,
      tagList: fixture.tags,
      favorited: false,
      favoritesCount: 0,
      author: { username: fixture.authorUsername, bio: 'Public bio', following: false },
    });
    expect(article).not.toHaveProperty('body');
    expect(article.author).not.toHaveProperty('email');
    expect(article.author).not.toHaveProperty('passwordHash');
    expect(response.headers['cache-control']).toBe('private, no-store');

    const maximumPage = await request(app.getHttpServer())
      .get('/api/articles')
      .query({ author: fixture.authorUsername, offset: 0, limit: 100 })
      .expect(200);
    expect(maximumPage.body.articlesCount).toBe(1);
    expect(maximumPage.body.articles).toHaveLength(1);
  });

  it('keeps the existing article detail route available', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));

    const response = await request(app.getHttpServer())
      .get(`/api/articles/${fixture.slug}`)
      .expect(200);

    expect(response.body.article.body).toBe('Detail body');
  });

  it('combines all filters, paginates before returning, and personalizes viewer state', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    const dataSource = app.get(DataSource);
    await dataSource.getRepository(ArticleFavorite).insert({
      articleId: fixture.articleId,
      userId: fixture.viewerId,
    });
    await dataSource.getRepository(UserFollow).insert({
      followerId: fixture.viewerId,
      followingId: fixture.authorId,
    });
    authenticateAs(app, fixture.viewerUsername);

    const response = await request(app.getHttpServer())
      .get('/api/articles')
      .query({
        tag: fixture.tags[0],
        author: fixture.authorUsername,
        favorited: fixture.viewerUsername,
        limit: 1,
      })
      .set('Authorization', 'Token test-token')
      .expect(200);

    expect(response.body.articlesCount).toBe(1);
    expect(response.body.articles).toHaveLength(1);
    expect(response.body.articles[0]).toMatchObject({
      slug: fixture.slug,
      favorited: true,
      favoritesCount: 1,
      author: { following: true },
    });
    const pastEnd = await request(app.getHttpServer())
      .get('/api/articles')
      .query({ author: fixture.authorUsername, offset: 1, limit: 1 })
      .expect(200);
    expect(pastEnd.body).toEqual({ articles: [], articlesCount: 1 });
  });

  it('returns empty pages for valid filters with no matching rows', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));

    for (const query of [
      { tag: `missing-${fixture.slug}` },
      { author: `missing-${fixture.slug}` },
      { favorited: `missing-${fixture.slug}` },
    ]) {
      const response = await request(app.getHttpServer())
        .get('/api/articles')
        .query(query)
        .expect(200);
      expect(response.body).toEqual({ articles: [], articlesCount: 0 });
    }
  });

  it('documents exactly the list query contract and optional token security', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    const response = await request(app.getHttpServer()).get('/docs-json').expect(200);
    const operation = response.body.paths['/api/articles'].get;

    expect(operation.parameters.map(({ name }: { name: string }) => name).sort()).toEqual(
      ['author', 'favorited', 'limit', 'offset', 'tag'],
    );
    expect(operation.security).toEqual([{ tokenAuth: [] }, {}]);
    const parameters = Object.fromEntries(
      operation.parameters.map((parameter: { name: string }) => [parameter.name, parameter]),
    );
    expect(parameters.offset.schema).toMatchObject({ type: 'integer', minimum: 0, default: 0 });
    expect(parameters.limit.schema).toMatchObject({
      type: 'integer', minimum: 1, maximum: 100, default: 20,
    });
    expect(operation.responses).toHaveProperty('200');
    expect(operation.responses).toHaveProperty('401');
    expect(operation.responses).toHaveProperty('422');
    expect(operation.responses).toHaveProperty('500');
    expect(operation.responses).not.toHaveProperty('404');
  });
});
