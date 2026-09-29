import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';

import { Comment } from '../src/comments/comment.entity.js';
import { UserFollow } from '../src/profiles/user-follow.entity.js';
import { createApp } from '../src/create-app.js';
import {
  authenticateAs,
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

describe('GET /api/articles/:slug/comments (e2e)', () => {
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

  it('returns an empty envelope when the article has no comments', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    const dataSource = app.get(DataSource);
    fixture = await createArticleFixture(dataSource);
    const transaction = vi.spyOn(dataSource, 'transaction');

    const response = await request(app.getHttpServer())
      .get(`/api/articles/${fixture.slug}/comments`)
      .expect(200);

    expect(response.body).toEqual({ comments: [] });
    expect(transaction.mock.calls[0]?.[0]).toBe('REPEATABLE READ');
  });

  it('orders comments, serializes public fields and batches following lookup', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    const dataSource = app.get(DataSource);
    fixture = await createArticleFixture(dataSource);
    const newerId = await insertComment(
      dataSource,
      fixture,
      'Newer',
      '2026-01-03T00:00:00Z',
    );
    const olderId = await insertComment(
      dataSource,
      fixture,
      'Older',
      '2026-01-01T00:00:00Z',
    );
    const tieIds = [
      await insertComment(
        dataSource,
        fixture,
        'Tie first',
        '2026-01-02T00:00:00Z',
      ),
      await insertComment(
        dataSource,
        fixture,
        'Tie second',
        '2026-01-02T00:00:00Z',
      ),
    ];
    await reverseCommentIdOrder(dataSource, tieIds[0], tieIds[1]);
    await dataSource.getRepository(UserFollow).insert({
      followerId: fixture.viewerId,
      followingId: fixture.authorId,
    });
    const anonymous = await request(app.getHttpServer())
      .get(`/api/articles/${fixture.slug}/comments`)
      .expect(200);
    expect(anonymous.body.comments.map(({ id }: { id: number }) => id)).toEqual(
      [olderId, ...tieIds.slice().sort((left, right) => left - right), newerId],
    );
    expect(
      anonymous.body.comments.map(
        ({ author }: { author: { following: boolean } }) => author.following,
      ),
    ).toEqual([false, false, false, false]);
    expect(anonymous.body.comments[0]).not.toHaveProperty('authorId');
    expect(anonymous.body.comments[0].author).not.toHaveProperty('email');
    expect(anonymous.body.comments[0].author).not.toHaveProperty(
      'passwordHash',
    );
    expect(
      anonymous.body.comments.map(({ body }: { body: string }) => body),
    ).toEqual(['Older', 'Tie second', 'Tie first', 'Newer']);
    authenticateAs(app, fixture.viewerUsername);
    const authenticated = await request(app.getHttpServer())
      .get(`/api/articles/${fixture.slug}/comments`)
      .set('Authorization', 'Token test-token')
      .expect(200);
    expect(
      authenticated.body.comments.map(
        ({ author }: { author: { following: boolean } }) => author.following,
      ),
    ).toEqual([true, true, true, true]);
    const docs = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const operation = docs.body.paths['/api/articles/{slug}/comments'].get;
    expect(operation.security).toEqual([{ tokenAuth: [] }, {}]);
    expect(Object.keys(operation.responses).sort()).toEqual([
      '200',
      '401',
      '404',
      '500',
    ]);
    expect(
      operation.responses['200'].content['application/json'].schema,
    ).toMatchObject({
      required: ['comments'],
      properties: { comments: { type: 'array' } },
    });
    expect(
      docs.body.paths['/api/articles/{slug}/comments'].post.security,
    ).toEqual([{ tokenAuth: [] }]);
  });
});

async function insertComment(
  dataSource: DataSource,
  fixture: ArticleFixture,
  body: string,
  createdAt: string,
): Promise<number> {
  const timestamp = new Date(createdAt);
  const result = await dataSource.getRepository(Comment).insert({
    articleId: fixture.articleId,
    authorId: fixture.authorId,
    body,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const id = result.identifiers[0]?.id;
  if (typeof id !== 'number')
    throw new Error('Comment insert did not return an id');
  return id;
}

async function reverseCommentIdOrder(
  dataSource: DataSource,
  firstId: number,
  secondId: number,
): Promise<void> {
  await dataSource.transaction(async (manager) => {
    const comments = manager.getRepository(Comment);
    const temporaryId = -Math.max(firstId, secondId) - 1;
    await comments.update({ id: firstId }, { id: temporaryId });
    await comments.update({ id: secondId }, { id: firstId });
    await comments.update({ id: temporaryId }, { id: secondId });
  });
}
