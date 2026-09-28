import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';

import { ArticleFavorite } from '../src/articles/article-favorite.entity.js';
import { Article } from '../src/articles/article.entity.js';
import { createApp } from '../src/create-app.js';
import {
  authenticateAs,
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

describe('DELETE /api/articles/:slug/favorite (e2e)', () => {
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

  it('unfavorites only the viewer and is idempotent', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    const favorites = app.get(DataSource).getRepository(ArticleFavorite);
    await favorites.insert([
      { articleId: fixture.articleId, userId: fixture.viewerId },
      { articleId: fixture.articleId, userId: fixture.authorId },
    ]);
    authenticateAs(app, fixture.viewerUsername);

    const response = await request(app.getHttpServer())
      .delete(`/api/articles/${fixture.slug}/favorite`)
      .set('Authorization', 'Token test-token')
      .expect(200);
    expect(response.body.article).toMatchObject({
      slug: fixture.slug,
      favorited: false,
      favoritesCount: 1,
    });
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(
      await favorites.findOneBy({
        articleId: fixture.articleId,
        userId: fixture.viewerId,
      }),
    ).toBeNull();
    expect(await favorites.countBy({ articleId: fixture.articleId })).toBe(1);

    const repeated = await request(app.getHttpServer())
      .delete(`/api/articles/${fixture.slug}/favorite`)
      .set('Authorization', 'Token test-token')
      .expect(200);
    expect(repeated.body.article.favorited).toBe(false);
    expect(repeated.body.article.favoritesCount).toBe(1);
  });

  it('requires authentication and returns not found for an unknown slug', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    await request(app.getHttpServer())
      .delete('/api/articles/missing/favorite')
      .expect(401)
      .expect({ errors: { token: ['is missing'] } });
    fixture = await createArticleFixture(app.get(DataSource));
    authenticateAs(app, fixture.viewerUsername);
    await request(app.getHttpServer())
      .delete('/api/articles/unknown-favorite-slug/favorite')
      .set('Authorization', 'Token test-token')
      .expect(404)
      .expect({ errors: { article: ['not found'] } });
  });

  it('serializes concurrent favorite and unfavorite requests consistently', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    authenticateAs(app, fixture.viewerUsername);

    const [favorited, unfavorited] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/articles/${fixture.slug}/favorite`)
        .set('Authorization', 'Token test-token'),
      request(app.getHttpServer())
        .delete(`/api/articles/${fixture.slug}/favorite`)
        .set('Authorization', 'Token test-token'),
    ]);
    expect(favorited.status).toBe(200);
    expect(unfavorited.status).toBe(200);

    const joined = await app
      .get(DataSource)
      .getRepository(ArticleFavorite)
      .countBy({
        articleId: fixture.articleId,
        userId: fixture.viewerId,
      });
    expect(joined).toBeLessThanOrEqual(1);
    const finalDetail = await request(app.getHttpServer())
      .get(`/api/articles/${fixture.slug}`)
      .set('Authorization', 'Token test-token')
      .expect(200);
    expect(finalDetail.body.article.favorited).toBe(joined === 1);
    expect(finalDetail.body.article.favoritesCount).toBe(joined);
  });

  it('does not leave a favorite when article deletion races with unfavorite', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    await app.get(DataSource).getRepository(ArticleFavorite).insert({
      articleId: fixture.articleId,
      userId: fixture.authorId,
    });
    authenticateAs(app, fixture.authorUsername);

    const [unfavorite, deletion] = await Promise.all([
      request(app.getHttpServer())
        .delete(`/api/articles/${fixture.slug}/favorite`)
        .set('Authorization', 'Token test-token'),
      request(app.getHttpServer())
        .delete(`/api/articles/${fixture.slug}`)
        .set('Authorization', 'Token test-token'),
    ]);
    expect([200, 404]).toContain(unfavorite.status);
    expect(deletion.status).toBe(204);
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
