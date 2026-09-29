import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
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

describe('DELETE /api/articles/:slug/comments/:id (e2e)', () => {
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
      if (app && fixture) {
        await cleanArticleFixture(app.get(DataSource), fixture);
      }
    } finally {
      await app?.close();
      fixture = undefined;
      otherArticleId = undefined;
    }
  });

  it('deletes only the selected owned comment with an empty 204', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    const dataSource = app.get(DataSource);
    fixture = await createArticleFixture(dataSource);
    const selectedId = await insertComment(
      dataSource,
      fixture.articleId,
      fixture.authorId,
      'selected',
    );
    const retainedId = await insertComment(
      dataSource,
      fixture.articleId,
      fixture.authorId,
      'retained',
    );
    authenticateAs(app, fixture.authorUsername);

    const response = await request(app.getHttpServer())
      .delete(`/api/articles/${fixture.slug}/comments/${selectedId}`)
      .set('Authorization', 'Token test-token')
      .expect(204);

    expect(response.text).toBe('');
    expect(
      await dataSource.getRepository(Comment).findOneBy({ id: selectedId }),
    ).toBeNull();
    expect(
      await dataSource.getRepository(Comment).findOneBy({ id: retainedId }),
    ).not.toBeNull();
  });

  it('documents success and every delete failure status in runtime Swagger', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    const docs = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const operation =
      docs.body.paths['/api/articles/{slug}/comments/{id}']?.delete;

    expect(operation.security).toEqual([{ tokenAuth: [] }]);
    expect(Object.keys(operation.responses).sort()).toEqual([
      '204',
      '401',
      '403',
      '404',
      '422',
      '500',
    ]);
    expect(
      operation.responses['403'].content['application/json'].schema.example,
    ).toEqual({ errors: { comment: ['forbidden'] } });
    expect(
      operation.responses['404'].content['application/json'].schema.anyOf.map(
        ({ example }: { example: unknown }) => example,
      ),
    ).toEqual([
      { errors: { article: ['not found'] } },
      { errors: { comment: ['not found'] } },
    ]);
    expect(
      operation.responses['422'].content['application/json'].schema.example,
    ).toEqual({ errors: { id: ['must be an integer'] } });
    expect(
      operation.responses['500'].content['application/json'].schema.example,
    ).toEqual({ errors: { body: ['request failed'] } });
  });
});

async function insertComment(
  dataSource: DataSource,
  articleId: string,
  authorId: string,
  body: string,
): Promise<number> {
  const result = await dataSource.getRepository(Comment).insert({
    articleId,
    authorId,
    body,
  });
  const id = result.identifiers[0]?.id;
  if (typeof id !== 'number')
    throw new Error('Comment insert did not return an id');
  return id;
}
