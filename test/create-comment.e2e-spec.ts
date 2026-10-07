import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';

import { Comment } from '../src/comments/comment.entity.js';
import { createApp } from '../src/create-app.js';
import {
  authenticateAs,
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

describe('POST /api/articles/:slug/comments (e2e)', () => {
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

  it('creates a trimmed comment for the authenticated user and documents its POST contract', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    authenticateAs(app, fixture.viewerUsername);

    const response = await request(app.getHttpServer())
      .post(`/api/articles/${fixture.slug}/comments`)
      .set('Authorization', 'Token test-token')
      .send({ comment: { body: '  Useful response  ' } })
      .expect(201);

    expect(response.body.comment).toMatchObject({
      body: 'Useful response',
      author: {
        bio: null,
        following: false,
        image: null,
        username: fixture.viewerUsername,
      },
    });
    expect(response.body.comment.id).toEqual(expect.any(Number));
    expect(response.body.comment.createdAt).toEqual(expect.any(String));
    expect(response.body.comment.updatedAt).toEqual(expect.any(String));
    expect(response.body.comment).not.toHaveProperty('authorId');
    expect(response.body.comment.author).not.toHaveProperty('email');
    expect(response.body.comment.author).not.toHaveProperty('passwordHash');
    expect(response.headers['cache-control']).toBe('private, no-store');

    const stored = await app
      .get(DataSource)
      .getRepository(Comment)
      .findBy({ articleId: fixture.articleId });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      authorId: fixture.viewerId,
      body: 'Useful response',
    });

    const docs = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const operation = docs.body.paths['/api/articles/{slug}/comments'].post;
    expect(operation.security).toEqual([{ tokenAuth: [] }]);
    expect(operation.responses).toEqual(
      expect.objectContaining({
        '201': expect.any(Object),
        '401': expect.any(Object),
        '404': expect.any(Object),
        '422': expect.any(Object),
        '500': expect.any(Object),
      }),
    );
    expect(
      operation.requestBody.content['application/json'].schema,
    ).toMatchObject({
      additionalProperties: false,
      required: ['comment'],
      properties: {
        comment: {
          additionalProperties: false,
          required: ['body'],
          properties: {
            body: { maxLength: 10_000, pattern: '\\S', type: 'string' },
          },
        },
      },
    });
  });

  it('requires authentication and rejects blank, oversized, or client-authored input', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    const endpoint = `/api/articles/${fixture.slug}/comments`;

    await request(app.getHttpServer())
      .post(endpoint)
      .send({ comment: { body: 'A comment' } })
      .expect(401)
      .expect({ errors: { token: ['is missing'] } });

    authenticateAs(app, fixture.viewerUsername);
    const authenticated = () =>
      request(app.getHttpServer())
        .post(endpoint)
        .set('Authorization', 'Token test-token');

    await authenticated()
      .send({ comment: { body: ' \t ' } })
      .expect(422)
      .expect({ errors: { body: ["can't be blank"] } });
    await authenticated()
      .send({ comment: { body: 'x'.repeat(10_001) } })
      .expect(422)
      .expect({ errors: { body: ['is invalid'] } });
    await authenticated()
      .send({ comment: { body: 'A comment', authorId: fixture.viewerId } })
      .expect(422)
      .expect((response) => {
        expect(response.body.errors).toHaveProperty('authorId');
      });

    expect(
      await app
        .get(DataSource)
        .getRepository(Comment)
        .countBy({ articleId: fixture.articleId }),
    ).toBe(0);
  });

  it('returns article not found without persisting a comment', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    authenticateAs(app, fixture.viewerUsername);

    await request(app.getHttpServer())
      .post(`/api/articles/missing-${randomUUID()}/comments`)
      .set('Authorization', 'Token test-token')
      .send({ comment: { body: 'No orphan comment' } })
      .expect(404)
      .expect({ errors: { article: ['not found'] } });

    expect(
      await app
        .get(DataSource)
        .getRepository(Comment)
        .countBy({ articleId: fixture.articleId }),
    ).toBe(0);
  });
});
