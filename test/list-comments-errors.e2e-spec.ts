import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';

import { createApp } from '../src/create-app.js';
import {
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

describe('GET /api/articles/:slug/comments errors (e2e)', () => {
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

  it('rejects invalid optional tokens and reports unknown articles', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));

    await request(app.getHttpServer())
      .get(`/api/articles/${fixture.slug}/comments`)
      .set('Authorization', 'Token invalid-token')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
    await request(app.getHttpServer())
      .get(`/api/articles/missing-${fixture.slug}/comments`)
      .expect(404)
      .expect({ errors: { article: ['not found'] } });
  });

  it('returns a generic persistence error without exposing database details', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    const dataSource = app.get(DataSource);
    fixture = await createArticleFixture(dataSource);
    vi.spyOn(dataSource, 'transaction').mockRejectedValueOnce(
      new Error('private database detail'),
    );

    await request(app.getHttpServer())
      .get(`/api/articles/${fixture.slug}/comments`)
      .expect(500)
      .expect({ errors: { body: ['request failed'] } });
  });
});
