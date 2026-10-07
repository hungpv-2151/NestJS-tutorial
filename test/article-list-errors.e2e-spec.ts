import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';

import {
  AuthInvalidTokenError,
  AuthService,
} from '../src/auth/auth.service.js';
import { createApp } from '../src/create-app.js';
import {
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

describe('GET /api/articles errors and contract', () => {
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

  it.each([
    ['malformed', 'abc'],
    ['fractional', '1.5'],
    ['negative', '-1'],
    ['unsafe', '9007199254740992'],
  ])('rejects %s offset with a 422 field error', async (_case, offset) => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    const response = await request(app.getHttpServer())
      .get('/api/articles')
      .query({ offset })
      .expect(422);
    expect(response.body.errors).toHaveProperty('offset');
  });

  it.each([
    ['malformed', 'abc'],
    ['fractional', '1.5'],
    ['negative', '-1'],
    ['zero', '0'],
    ['unsafe', '9007199254740992'],
    ['over the cap', '101'],
  ])('rejects %s limit with a 422 field error', async (_case, limit) => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    const response = await request(app.getHttpServer())
      .get('/api/articles')
      .query({ limit })
      .expect(422);
    expect(response.body.errors).toHaveProperty('limit');
  });

  it('rejects unknown query keys instead of silently ignoring them', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    await request(app.getHttpServer())
      .get('/api/articles?search=ignored')
      .expect(422);
  });

  it('rejects malformed and invalid supplied tokens while allowing guests elsewhere', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    await request(app.getHttpServer())
      .get('/api/articles')
      .set('Authorization', 'Bearer malformed')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
    vi.spyOn(app.get(AuthService), 'authenticate').mockRejectedValue(
      new AuthInvalidTokenError(),
    );
    await request(app.getHttpServer())
      .get('/api/articles')
      .set('Authorization', 'Token invalid')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
  });

  it('rejects a verified token whose subject no longer has a user row', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
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
      .get('/api/articles?tag=missing')
      .set('Authorization', 'Token verified-stale')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
  });

  it('maps list persistence failures to a generic 500 without leaking internals', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    const { ArticleListService, ArticleListPersistenceError } =
      await import('../src/articles/article.service.js');
    vi.spyOn(app.get(ArticleListService), 'list').mockRejectedValue(
      new ArticleListPersistenceError(new Error('secret database detail')),
    );

    const response = await request(app.getHttpServer())
      .get('/api/articles')
      .expect(500)
      .expect({ errors: { body: ['request failed'] } });
    expect(JSON.stringify(response.body)).not.toContain(
      'secret database detail',
    );
  });
});
