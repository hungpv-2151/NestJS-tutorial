import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';

import { ArticleFavorite } from '../src/articles/article-favorite.entity.js';
import { ArticleReadService } from '../src/articles/article-read.service.js';
import { createApp } from '../src/create-app.js';
import {
  authenticateAs,
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

describe('POST /api/articles/:slug/favorite errors and contract (e2e)', () => {
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

  it('redacts read failures, rolls back the favorite, and publishes the POST contract', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    authenticateAs(app, fixture.viewerUsername);
    vi.spyOn(app.get(ArticleReadService), 'getBySlug').mockRejectedValue(
      new Error('private database failure'),
    );
    const failed = await request(app.getHttpServer())
      .post(`/api/articles/${fixture.slug}/favorite`)
      .set('Authorization', 'Token test-token')
      .expect(500)
      .expect({ errors: { body: ['internal server error'] } });
    expect(JSON.stringify(failed.body)).not.toContain(
      'private database failure',
    );
    expect(
      await app.get(DataSource).getRepository(ArticleFavorite).countBy({
        articleId: fixture.articleId,
        userId: fixture.viewerId,
      }),
    ).toBe(0);

    const docs = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const operation = docs.body.paths['/api/articles/{slug}/favorite']?.post;
    expect(operation).toBeDefined();
    expect(operation.security).toEqual([{ tokenAuth: [] }]);
    expect(operation.parameters).toEqual([
      expect.objectContaining({ name: 'slug', in: 'path', required: true }),
    ]);
    expect(operation).not.toHaveProperty('requestBody');
    expect(Object.keys(operation.responses).sort()).toEqual([
      '200',
      '401',
      '404',
      '422',
      '500',
    ]);

    const articleSchema = docs.body.components.schemas.FavoriteArticleResponse;
    expect(articleSchema.required.sort()).toEqual([
      'author',
      'body',
      'createdAt',
      'description',
      'favorited',
      'favoritesCount',
      'slug',
      'tagList',
      'title',
      'updatedAt',
    ]);
    const profileSchema =
      docs.body.components.schemas.FavoriteArticleProfileResponse;
    expect(profileSchema.required.sort()).toEqual([
      'bio',
      'following',
      'image',
      'username',
    ]);
    expect(
      operation.responses['200'].content['application/json'].schema,
    ).toEqual({
      additionalProperties: false,
      properties: {
        article: { $ref: '#/components/schemas/FavoriteArticleResponse' },
      },
      required: ['article'],
      type: 'object',
    });
  });
});
