import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';

import { Article } from '../src/articles/article.entity.js';
import { AuthInvalidTokenError, AuthService } from '../src/auth/auth.service.js';
import { createApp } from '../src/create-app.js';
import {
  authenticateAs,
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

describe('PUT /api/articles/:slug authorization and errors (e2e)', () => {
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

  it('documents strict update request schemas and nonblank tag items', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const document = response.body as OpenApiDocument;
    const schema =
      document.paths['/api/articles/{slug}'].put.requestBody.content[
        'application/json'
      ].schema;
    const wrapper = resolveSchema(document, schema);
    const article = resolveSchema(document, wrapper.properties.article);

    expect(wrapper.additionalProperties).toBe(false);
    expect(article.additionalProperties).toBe(false);
    expect(article.properties.tagList.items.pattern).toBe('\\S');
  });

  it('rejects a non-owner without changing the article', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    const original = await app
      .get(DataSource)
      .getRepository(Article)
      .findOneByOrFail({ id: fixture.articleId });
    authenticateAs(app, fixture.viewerUsername);

    await request(app.getHttpServer())
      .put(`/api/articles/${fixture.slug}`)
      .set('Authorization', 'Token test-token')
      .send({ article: { title: 'Unauthorized edit' } })
      .expect(403)
      .expect({ errors: { article: ['forbidden'] } });

    const unchanged = await app
      .get(DataSource)
      .getRepository(Article)
      .findOneByOrFail({ id: fixture.articleId });
    expect(unchanged.title).toBe(original.title);
    expect(unchanged.updatedAt.toISOString()).toBe(
      original.updatedAt.toISOString(),
    );
  });

  it('returns not found for an unknown slug and validates null tags', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    authenticateAs(app, fixture.authorUsername);

    await request(app.getHttpServer())
      .put(`/api/articles/missing-${randomUUID()}`)
      .set('Authorization', 'Token test-token')
      .send({ article: {} })
      .expect(404)
      .expect({ errors: { article: ['not found'] } });

    await request(app.getHttpServer())
      .put(`/api/articles/${fixture.slug}`)
      .set('Authorization', 'Token test-token')
      .send({ article: { tagList: null } })
      .expect(422)
      .expect((response) => {
        expect(response.body.errors).toHaveProperty('tagList');
      });
  });

  it('rejects missing and invalid authentication', async () => {
    app = await createApp({ NODE_ENV: 'test' });

    await request(app.getHttpServer())
      .put(`/api/articles/${randomUUID()}`)
      .send({ article: {} })
      .expect(401)
      .expect({ errors: { token: ['is missing'] } });

    vi.spyOn(app.get(AuthService), 'authenticate').mockRejectedValue(
      new AuthInvalidTokenError(),
    );
    await request(app.getHttpServer())
      .put(`/api/articles/${randomUUID()}`)
      .set('Authorization', 'Token invalid-token')
      .send({ article: {} })
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
  });
});

interface OpenApiSchema {
  $ref?: string;
  additionalProperties?: boolean;
  items?: OpenApiSchema;
  pattern?: string;
  properties?: Record<string, OpenApiSchema>;
}

interface OpenApiDocument {
  components: { schemas: Record<string, OpenApiSchema> };
  paths: {
    '/api/articles/{slug}': {
      put: {
        requestBody: {
          content: { 'application/json': { schema: OpenApiSchema } };
        };
      };
    };
  };
}

function resolveSchema(
  document: OpenApiDocument,
  schema: OpenApiSchema,
): OpenApiSchema {
  if (!schema.$ref) return schema;
  const name = schema.$ref.split('/').at(-1);
  return document.components.schemas[name];
}
