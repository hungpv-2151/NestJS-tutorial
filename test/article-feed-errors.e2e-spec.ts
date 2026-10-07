import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';

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

describe('GET /api/articles/feed errors (e2e)', () => {
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

  it('requires a token and redacts malformed or invalid credentials', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    await request(app.getHttpServer())
      .get('/api/articles/feed')
      .expect(401)
      .expect({ errors: { token: ['is missing'] } });
    vi.spyOn(app.get(AuthService), 'authenticate').mockRejectedValue(
      new AuthInvalidTokenError(),
    );
    await request(app.getHttpServer())
      .get('/api/articles/feed')
      .set('Authorization', 'Token malformed')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
    await request(app.getHttpServer())
      .get('/api/articles/feed')
      .set('Authorization', 'Token invalid')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
  });

  it('rejects bad pagination and keys outside the feed contract', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    authenticateAs(app, fixture.viewerUsername);
    for (const query of [
      '?offset=-1',
      '?offset=1.5',
      '?offset=9007199254740992',
      '?limit=0',
      '?limit=101',
      '?limit=1.5',
      '?author=ignored',
      '?search=ignored',
    ]) {
      const response = await request(app.getHttpServer())
        .get(`/api/articles/feed${query}`)
        .set('Authorization', 'Token test-token')
        .expect(422);
      expect(Object.keys(response.body.errors).length).toBeGreaterThan(0);
    }
  });

  it('rejects a verified token whose user no longer exists', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    vi.spyOn(app.get(AuthService), 'authenticate').mockResolvedValue({
      aud: 'test',
      exp: 2_000_000_000,
      iat: 1_900_000_000,
      iss: 'test',
      jti: randomUUID(),
      sub: `deleted-${randomUUID()}`,
    });
    await request(app.getHttpServer())
      .get('/api/articles/feed')
      .set('Authorization', 'Token verified-stale')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
  });

  it('maps persistence failures to a generic error without exposing details', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    authenticateAs(app, fixture.viewerUsername);
    const { ArticleListService, ArticleListPersistenceError } =
      await import('../src/articles/article.service.js');
    vi.spyOn(app.get(ArticleListService), 'feed').mockRejectedValue(
      new ArticleListPersistenceError(new Error('private database detail')),
    );
    const response = await request(app.getHttpServer())
      .get('/api/articles/feed')
      .set('Authorization', 'Token test-token')
      .expect(500)
      .expect({ errors: { body: ['request failed'] } });
    expect(JSON.stringify(response.body)).not.toContain(
      'private database detail',
    );
  });
});
