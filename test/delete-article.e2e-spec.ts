import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';

import { ArticleFavorite } from '../src/articles/article-favorite.entity.js';
import { ArticleTag } from '../src/articles/article-tag.entity.js';
import { Article } from '../src/articles/article.entity.js';
import {
  AuthInvalidTokenError,
  AuthService,
} from '../src/auth/auth.service.js';
import { Tag } from '../src/tags/tag.entity.js';
import { createApp } from '../src/create-app.js';
import {
  authenticateAs,
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

describe('DELETE /api/articles/:slug (e2e)', () => {
  let app: INestApplication;
  let fixture: ArticleFixture | undefined;
  let sharedArticleId: string | undefined;

  afterEach(async () => {
    try {
      if (app && sharedArticleId) {
        await app
          .get(DataSource)
          .getRepository(Article)
          .delete({ id: sharedArticleId });
      }
      if (app && fixture) {
        await cleanArticleFixture(app.get(DataSource), fixture);
      }
    } finally {
      await app?.close();
      fixture = undefined;
      sharedArticleId = undefined;
    }
  });

  it('deletes an owned article with an empty 204 and preserves shared tags', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    const dataSource = app.get(DataSource);
    const sharedTag = await dataSource
      .getRepository(Tag)
      .findOneByOrFail({ name: fixture.tags[0] });
    const sharedArticle = await dataSource.getRepository(Article).save({
      slug: `survivor-${randomUUID()}`,
      title: 'Surviving article',
      description: 'Uses shared tag',
      body: 'Still here',
      authorId: fixture.authorId,
    });
    sharedArticleId = sharedArticle.id;
    await dataSource.getRepository(ArticleTag).insert({
      articleId: sharedArticle.id,
      tagId: sharedTag.id,
      position: 0,
    });
    await dataSource.getRepository(ArticleFavorite).insert({
      articleId: fixture.articleId,
      userId: fixture.viewerId,
    });
    authenticateAs(app, fixture.authorUsername);

    const response = await request(app.getHttpServer())
      .delete(`/api/articles/${fixture.slug}`)
      .set('Authorization', 'Token test-token')
      .expect(204);

    expect(response.text).toBe('');
    await request(app.getHttpServer())
      .get(`/api/articles/${fixture.slug}`)
      .expect(404)
      .expect({ errors: { article: ['not found'] } });
    expect(
      await dataSource
        .getRepository(Article)
        .findOneBy({ id: fixture.articleId }),
    ).toBeNull();
    expect(
      await dataSource
        .getRepository(ArticleTag)
        .countBy({ articleId: fixture.articleId }),
    ).toBe(0);
    expect(
      await dataSource
        .getRepository(ArticleFavorite)
        .countBy({ articleId: fixture.articleId }),
    ).toBe(0);
    expect(
      await dataSource.getRepository(Tag).findOneBy({ id: sharedTag.id }),
    ).not.toBeNull();
    expect(
      await dataSource
        .getRepository(ArticleTag)
        .countBy({ articleId: sharedArticle.id }),
    ).toBe(1);
  });

  it('requires authentication and rejects an invalid token', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    const url = `/api/articles/${fixture.slug}`;

    await request(app.getHttpServer())
      .delete(url)
      .expect(401)
      .expect({ errors: { token: ['is missing'] } });

    await request(app.getHttpServer())
      .delete(url)
      .set('Authorization', 'Bearer malformed-token')
      .expect(401)
      .expect({ errors: { token: ['is missing'] } });

    vi.spyOn(app.get(AuthService), 'authenticate').mockRejectedValue(
      new AuthInvalidTokenError(),
    );
    await request(app.getHttpServer())
      .delete(url)
      .set('Authorization', 'Token invalid-token')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
  });

  it('rejects a non-owner without changing the article or joins', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    const dataSource = app.get(DataSource);
    await dataSource.getRepository(ArticleFavorite).insert({
      articleId: fixture.articleId,
      userId: fixture.viewerId,
    });
    authenticateAs(app, fixture.viewerUsername);

    await request(app.getHttpServer())
      .delete(`/api/articles/${fixture.slug}`)
      .set('Authorization', 'Token test-token')
      .expect(403)
      .expect({ errors: { article: ['forbidden'] } });

    expect(
      await dataSource
        .getRepository(Article)
        .findOneBy({ id: fixture.articleId }),
    ).not.toBeNull();
    expect(
      await dataSource
        .getRepository(ArticleTag)
        .countBy({ articleId: fixture.articleId }),
    ).toBe(2);
    expect(
      await dataSource
        .getRepository(ArticleFavorite)
        .countBy({ articleId: fixture.articleId }),
    ).toBe(1);
  });

  it('returns article not-found for an unknown slug', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    authenticateAs(app, fixture.authorUsername);

    await request(app.getHttpServer())
      .delete(`/api/articles/missing-${randomUUID()}`)
      .set('Authorization', 'Token test-token')
      .expect(404)
      .expect({ errors: { article: ['not found'] } });
  });
});
