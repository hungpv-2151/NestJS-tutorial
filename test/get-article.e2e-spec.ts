import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';

import {
  AuthInvalidTokenError,
  AuthService,
} from '../src/auth/auth.service.js';
import { ArticleFavorite } from '../src/articles/article-favorite.entity.js';
import { createApp } from '../src/create-app.js';
import { UserFollow } from '../src/profiles/user-follow.entity.js';
import {
  authenticateAs,
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

describe('GET /api/articles/:slug (e2e)', () => {
  let app: INestApplication;
  let fixture: ArticleFixture | undefined;

  afterEach(async () => {
    try {
      if (app && fixture) {
        await cleanArticleFixture(app.get(DataSource), fixture);
      }
    } finally {
      await app?.close();
      fixture = undefined;
    }
  });

  it('returns public article details to a guest with ordered tags and favorite count', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    const favorites = app.get(DataSource).getRepository(ArticleFavorite);
    await favorites.insert([
      { articleId: fixture.articleId, userId: fixture.viewerId },
      { articleId: fixture.articleId, userId: fixture.authorId },
    ]);

    const response = await request(app.getHttpServer())
      .get(`/api/articles/${fixture.slug}`)
      .expect(200);

    expect(response.body.article).toMatchObject({
      slug: fixture.slug,
      title: 'Article detail',
      description: 'Detail description',
      body: 'Detail body',
      tagList: fixture.tags,
      favorited: false,
      favoritesCount: 2,
      author: {
        username: fixture.authorUsername,
        bio: 'Public bio',
        image: null,
        following: false,
      },
    });
    expect(response.body.article.author).not.toHaveProperty('email');
    expect(response.body.article.author).not.toHaveProperty('passwordHash');
    expect(response.body.article.author).not.toHaveProperty('id');
  });

  it('returns viewer favorite and author follow state for a valid token', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    const favorites = app.get(DataSource).getRepository(ArticleFavorite);
    await favorites.insert([
      { articleId: fixture.articleId, userId: fixture.viewerId },
      { articleId: fixture.articleId, userId: fixture.authorId },
    ]);
    await app.get(DataSource).getRepository(UserFollow).insert({
      followerId: fixture.viewerId,
      followingId: fixture.authorId,
    });
    authenticateAs(app, fixture.viewerUsername);

    const response = await request(app.getHttpServer())
      .get(`/api/articles/${fixture.slug}`)
      .set('Authorization', 'Token test-token')
      .expect(200);

    expect(response.body.article.favorited).toBe(true);
    expect(response.body.article.author.following).toBe(true);
  });

  it('returns the article not-found envelope for an unknown slug', async () => {
    app = await createApp({ NODE_ENV: 'test' });

    await request(app.getHttpServer())
      .get(`/api/articles/missing-${randomUUID()}`)
      .expect(404)
      .expect({ errors: { article: ['not found'] } });
  });

  it('rejects a supplied invalid token', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    const authService = app.get(AuthService);
    vi.spyOn(authService, 'authenticate').mockRejectedValue(
      new AuthInvalidTokenError(),
    );

    await request(app.getHttpServer())
      .get(`/api/articles/missing-${randomUUID()}`)
      .set('Authorization', 'Token invalid-token')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
  });

  it('rejects a malformed supplied token as invalid', async () => {
    app = await createApp({ NODE_ENV: 'test' });

    await request(app.getHttpServer())
      .get(`/api/articles/missing-${randomUUID()}`)
      .set('Authorization', 'Bearer malformed-token')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
  });

  it('rejects an empty supplied authorization header as invalid', async () => {
    app = await createApp({ NODE_ENV: 'test' });

    await request(app.getHttpServer())
      .get(`/api/articles/missing-${randomUUID()}`)
      .set('Authorization', '')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
  });

  it('documents token auth as optional with an invalid-token response', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const operation = response.body.paths['/api/articles/{slug}'].get;

    expect(operation.security).toEqual([{ tokenAuth: [] }, {}]);
    expect(
      operation.responses['401'].content['application/json'].schema.example,
    ).toEqual({ errors: { token: ['is invalid'] } });
  });
});
