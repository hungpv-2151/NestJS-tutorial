import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';

import { Article } from '../src/articles/article.entity.js';
import { Comment } from '../src/comments/comment.entity.js';
import { createApp } from '../src/create-app.js';
import {
  authenticateAs,
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

describe('DELETE /api/articles/:slug/comments/:id errors (e2e)', () => {
  let app: INestApplication;
  let fixture: ArticleFixture | undefined;
  let otherArticleId: string | undefined;

  afterEach(async () => {
    try {
      if (app && otherArticleId) {
        await app
          .get(DataSource)
          .getRepository(Article)
          .delete({ id: otherArticleId });
      }
      if (app && fixture)
        await cleanArticleFixture(app.get(DataSource), fixture);
    } finally {
      await app?.close();
      fixture = undefined;
      otherArticleId = undefined;
    }
  });

  it('requires a valid token and preserves a comment after owner mismatch', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    const dataSource = app.get(DataSource);
    fixture = await createArticleFixture(dataSource);
    const id = await insertComment(
      dataSource,
      fixture.articleId,
      fixture.authorId,
    );
    const url = `/api/articles/${fixture.slug}/comments/${id}`;

    await request(app.getHttpServer())
      .delete(url)
      .expect(401)
      .expect({ errors: { token: ['is missing'] } });
    await request(app.getHttpServer())
      .delete(url)
      .set('Authorization', 'Token invalid-token')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
    authenticateAs(app, fixture.viewerUsername);
    await request(app.getHttpServer())
      .delete(url)
      .set('Authorization', 'Token test-token')
      .expect(403)
      .expect({ errors: { comment: ['forbidden'] } });
    expect(
      await dataSource.getRepository(Comment).findOneBy({ id }),
    ).not.toBeNull();
  });

  it('distinguishes an unknown article from a missing or wrong-article comment', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    const dataSource = app.get(DataSource);
    fixture = await createArticleFixture(dataSource);
    const otherArticle = await dataSource.getRepository(Article).save({
      slug: `other-${fixture.slug}`,
      title: 'Other',
      description: 'Other',
      body: 'Other',
      authorId: fixture.authorId,
    });
    otherArticleId = otherArticle.id;
    const otherCommentId = await insertComment(
      dataSource,
      otherArticle.id,
      fixture.authorId,
    );
    authenticateAs(app, fixture.authorUsername);

    await request(app.getHttpServer())
      .delete(
        `/api/articles/missing-${fixture.slug}/comments/${otherCommentId}`,
      )
      .set('Authorization', 'Token test-token')
      .expect(404)
      .expect({ errors: { article: ['not found'] } });
    await request(app.getHttpServer())
      .delete(`/api/articles/${fixture.slug}/comments/${otherCommentId}`)
      .set('Authorization', 'Token test-token')
      .expect(404)
      .expect({ errors: { comment: ['not found'] } });
    await request(app.getHttpServer())
      .delete(`/api/articles/${fixture.slug}/comments/999999999`)
      .set('Authorization', 'Token test-token')
      .expect(404)
      .expect({ errors: { comment: ['not found'] } });
    expect(
      await dataSource.getRepository(Comment).findOneBy({ id: otherCommentId }),
    ).not.toBeNull();
  });

  it('returns a documented validation error for a non-integer ID', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    authenticateAs(app, fixture.authorUsername);

    await request(app.getHttpServer())
      .delete(`/api/articles/${fixture.slug}/comments/invalid`)
      .set('Authorization', 'Token test-token')
      .expect(422)
      .expect({ errors: { id: ['must be an integer'] } });
  });

  it('hides database details after a persistence failure', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    const dataSource = app.get(DataSource);
    fixture = await createArticleFixture(dataSource);
    const id = await insertComment(
      dataSource,
      fixture.articleId,
      fixture.authorId,
    );
    authenticateAs(app, fixture.authorUsername);
    vi.spyOn(dataSource, 'transaction').mockRejectedValueOnce(
      new Error('private database detail'),
    );

    await request(app.getHttpServer())
      .delete(`/api/articles/${fixture.slug}/comments/${id}`)
      .set('Authorization', 'Token test-token')
      .expect(500)
      .expect({ errors: { body: ['request failed'] } });
    expect(
      await dataSource.getRepository(Comment).findOneBy({ id }),
    ).not.toBeNull();
  });
});

async function insertComment(
  dataSource: DataSource,
  articleId: string,
  authorId: string,
): Promise<number> {
  const result = await dataSource
    .getRepository(Comment)
    .insert({ articleId, authorId, body: 'owned' });
  const id = result.identifiers[0]?.id;
  if (typeof id !== 'number')
    throw new Error('Comment insert did not return an id');
  return id;
}
