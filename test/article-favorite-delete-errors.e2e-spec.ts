import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';

import { ArticleFavorite } from '../src/articles/article-favorite.entity.js';
import { ArticleReadService } from '../src/articles/article-read.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { createApp } from '../src/create-app.js';
import {
  authenticateAs,
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

describe('DELETE favorite errors and contract (e2e)', () => {
  let app: INestApplication;
  let fixture: ArticleFixture | undefined;

  afterEach(async () => {
    try {
      if (app && fixture)
        await cleanArticleFixture(app.get(DataSource), fixture);
    } finally {
      await app?.close();
      fixture = undefined;
      vi.restoreAllMocks();
    }
  });

  it('redacts read failures, rolls back the deletion, and publishes DELETE docs', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    const favorites = app.get(DataSource).getRepository(ArticleFavorite);
    await favorites.insert({
      articleId: fixture.articleId,
      userId: fixture.viewerId,
    });
    authenticateAs(app, fixture.viewerUsername);
    vi.spyOn(app.get(ArticleReadService), 'getBySlug').mockRejectedValue(
      new Error('private database failure'),
    );

    const failed = await request(app.getHttpServer())
      .delete(`/api/articles/${fixture.slug}/favorite`)
      .set('Authorization', 'Token test-token')
      .expect(500)
      .expect({ errors: { body: ['internal server error'] } });
    expect(JSON.stringify(failed.body)).not.toContain(
      'private database failure',
    );
    expect(
      await favorites.findOneBy({
        articleId: fixture.articleId,
        userId: fixture.viewerId,
      }),
    ).not.toBeNull();

    vi.restoreAllMocks();
    const docs = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const operation = docs.body.paths['/api/articles/{slug}/favorite']?.delete;
    expect(operation).toBeDefined();
    expect(operation.security).toEqual([{ tokenAuth: [] }]);
    expect(operation.parameters).toEqual([
      expect.objectContaining({
        name: 'slug',
        in: 'path',
        required: true,
        description: 'Slug of the article to unfavorite.',
      }),
    ]);
    expect(operation).not.toHaveProperty('requestBody');
    expect(Object.keys(operation.responses).sort()).toEqual([
      '200',
      '401',
      '404',
      '422',
      '500',
    ]);
    expect(operation.responses['500'].description).toBe(
      'Favorite could not be deleted.',
    );
    expect(
      docs.body.paths['/api/articles/{slug}/favorite'].post.responses['500']
        .description,
    ).toBe('Favorite could not be created.');
  });

  it('maps a valid token with a deleted viewer to unauthorized', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    vi.spyOn(app.get(AuthService), 'authenticate').mockResolvedValue({
      aud: 'test',
      exp: 2_000_000_000,
      iat: 1_900_000_000,
      iss: 'test',
      jti: 'stale-viewer',
      sub: `deleted-${fixture.viewerUsername}`,
    });

    await request(app.getHttpServer())
      .delete(`/api/articles/${fixture.slug}/favorite`)
      .set('Authorization', 'Token stale')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
  });
});
