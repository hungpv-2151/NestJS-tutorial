import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';

import { ArticleFavorite } from '../src/articles/article-favorite.entity.js';
import { Article } from '../src/articles/article.entity.js';
import {
  AuthInvalidTokenError,
  AuthService,
} from '../src/auth/auth.service.js';
import { createApp } from '../src/create-app.js';
import {
  authenticateAs,
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

describe('POST /api/articles/:slug/favorite (e2e)', () => {
  let app: INestApplication;
  let fixture: ArticleFixture | undefined;

  afterEach(async () => {
    try {
      if (app && fixture)
        await cleanArticleFixture(app.get(DataSource), fixture);
    } finally {
      await app?.close();
      fixture = undefined;
    }
  });

  it('works on the initialized app and returns a personalized detail response', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    authenticateAs(app, fixture.viewerUsername);

    const control = await request(app.getHttpServer())
      .get(`/api/articles/${fixture.slug}`)
      .expect(200);
    expect(control.body.article.body).toBe('Detail body');
    const first = await request(app.getHttpServer())
      .post(`/api/articles/${fixture.slug}/favorite`)
      .set('Authorization', 'Token test-token')
      .expect(200);
    expect(first.body.article).toMatchObject({
      slug: fixture.slug,
      body: 'Detail body',
      tagList: fixture.tags,
      favorited: true,
      favoritesCount: 1,
      author: { username: fixture.authorUsername, following: false },
    });
    expect(first.body.article.createdAt).toMatch(/^\d{4}-\d\d-/);
    expect(first.body.article.updatedAt).toMatch(/^\d{4}-\d\d-/);
    expect(first.body.article.author).not.toHaveProperty('email');
    expect(first.body.article.author).not.toHaveProperty('passwordHash');
    expect(first.headers['cache-control']).toBe('private, no-store');
    expect(
      await app.get(DataSource).getRepository(ArticleFavorite).countBy({
        articleId: fixture.articleId,
        userId: fixture.viewerId,
      }),
    ).toBe(1);

    const concurrent = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post(`/api/articles/${fixture!.slug}/favorite`)
          .set('Authorization', 'Token test-token'),
      ),
    );
    expect(concurrent.map(({ status }) => status)).toEqual([200, 200]);
    expect(
      await app.get(DataSource).getRepository(ArticleFavorite).countBy({
        articleId: fixture.articleId,
        userId: fixture.viewerId,
      }),
    ).toBe(1);

    const repeated = await request(app.getHttpServer())
      .post(`/api/articles/${fixture.slug}/favorite`)
      .set('Authorization', 'Token test-token')
      .expect(200);
    expect(repeated.body.article.favoritesCount).toBe(1);
    authenticateAs(app, fixture.authorUsername);
    const second = await request(app.getHttpServer())
      .post(`/api/articles/${fixture.slug}/favorite`)
      .set('Authorization', 'Token test-token')
      .expect(200);
    expect(second.body.article.favoritesCount).toBe(2);
    authenticateAs(app, fixture.viewerUsername);
    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/articles/${fixture.slug}/favorite`)
          .set('Authorization', 'Token test-token')
          .expect(200)
      ).body.article.favoritesCount,
    ).toBe(2);
    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/articles/${fixture.slug}`)
          .set('Authorization', 'Token test-token')
          .expect(200)
      ).body.article.favorited,
    ).toBe(true);
  }, 20_000);

  it('requires a valid viewer and reports unknown articles with the documented errors', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    await request(app.getHttpServer())
      .post('/api/articles/missing/favorite')
      .expect(401)
      .expect({ errors: { token: ['is missing'] } });
    vi.spyOn(app.get(AuthService), 'authenticate').mockRejectedValue(
      new AuthInvalidTokenError(),
    );
    await request(app.getHttpServer())
      .post('/api/articles/missing/favorite')
      .set('Authorization', 'Token invalid')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
    fixture = await createArticleFixture(app.get(DataSource));
    vi.restoreAllMocks();
    vi.spyOn(app.get(AuthService), 'authenticate').mockResolvedValue({
      aud: 'test',
      exp: 2_000_000_000,
      iat: 1_900_000_000,
      iss: 'test',
      jti: 'stale-viewer',
      sub: `deleted-${fixture.viewerUsername}`,
    });
    await request(app.getHttpServer())
      .post(`/api/articles/${fixture.slug}/favorite`)
      .set('Authorization', 'Token stale')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
    authenticateAs(app, fixture.viewerUsername);
    await request(app.getHttpServer())
      .post('/api/articles/unknown-favorite-slug/favorite')
      .set('Authorization', 'Token test-token')
      .expect(404)
      .expect({ errors: { article: ['not found'] } });
  });

  it('cleans up favorites when article deletion races with favorite creation', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    authenticateAs(app, fixture.authorUsername);

    const [favorite, deletion] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/articles/${fixture.slug}/favorite`)
        .set('Authorization', 'Token test-token'),
      request(app.getHttpServer())
        .delete(`/api/articles/${fixture.slug}`)
        .set('Authorization', 'Token test-token'),
    ]);

    expect(deletion.status).toBe(204);
    expect([200, 404]).toContain(favorite.status);
    expect(
      await app
        .get(DataSource)
        .getRepository(Article)
        .findOneBy({ id: fixture.articleId }),
    ).toBeNull();
    expect(
      await app.get(DataSource).getRepository(ArticleFavorite).countBy({
        articleId: fixture.articleId,
      }),
    ).toBe(0);
  });
});
