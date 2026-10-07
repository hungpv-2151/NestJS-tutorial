import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';

import {
  ArticleDeletePersistenceError,
  ArticleDeleteService,
} from '../src/articles/article.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { createApp } from '../src/create-app.js';
import {
  authenticateAs,
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

describe('DELETE /api/articles/:slug error handling and docs (e2e)', () => {
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

  it('maps a valid token for a deleted user to invalid-token 401', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    vi.spyOn(app.get(AuthService), 'authenticate').mockResolvedValue({
      aud: 'test',
      exp: 2_000_000_000,
      iat: 1_900_000_000,
      iss: 'test',
      jti: randomUUID(),
      sub: `deleted-${randomUUID()}`,
    });

    await request(app.getHttpServer())
      .delete(`/api/articles/${fixture.slug}`)
      .set('Authorization', 'Token test-token')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
  });

  it('returns a generic 500 without leaking persistence details', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    authenticateAs(app, fixture.authorUsername);
    const service = app.get(ArticleDeleteService);
    vi.spyOn(service, 'delete').mockRejectedValue(
      new ArticleDeletePersistenceError(new Error('secret database detail')),
    );

    const response = await request(app.getHttpServer())
      .delete(`/api/articles/${fixture.slug}`)
      .set('Authorization', 'Token test-token')
      .expect(500)
      .expect({ errors: { body: ['request failed'] } });

    expect(JSON.stringify(response.body)).not.toContain(
      'secret database detail',
    );
  });

  it('documents article-key 403 and 404 examples for DELETE', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const operation = response.body.paths['/api/articles/{slug}'].delete;

    expect(
      operation.responses['403'].content['application/json'].schema.example,
    ).toEqual({ errors: { article: ['forbidden'] } });
    expect(
      operation.responses['404'].content['application/json'].schema.example,
    ).toEqual({ errors: { article: ['not found'] } });
    expect(operation.responses).toHaveProperty('500');
    expect(operation.responses).not.toHaveProperty('422');
    expect(
      operation.responses['500'].content['application/json'].schema.example,
    ).toEqual({ errors: { body: ['request failed'] } });
  });
});
