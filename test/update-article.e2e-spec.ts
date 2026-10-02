import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { DataSource, In } from 'typeorm';

import { Article } from '../src/articles/article.entity.js';
import { ArticleFavorite } from '../src/articles/article-favorite.entity.js';
import { createApp } from '../src/create-app.js';
import { Tag } from '../src/tags/tag.entity.js';
import {
  authenticateAs,
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

describe('PUT /api/articles/:slug owner behavior (e2e)', () => {
  let app: INestApplication;
  let fixture: ArticleFixture | undefined;
  let replacementTagNames: string[] = [];

  afterEach(async () => {
    try {
      if (app && fixture) {
        await cleanArticleFixture(app.get(DataSource), fixture);
      }
      if (app && replacementTagNames.length > 0) {
        await app
          .get(DataSource)
          .getRepository(Tag)
          .delete({ name: In(replacementTagNames) });
      }
    } finally {
      await app?.close();
      fixture = undefined;
      replacementTagNames = [];
    }
  });

  it('partially updates content, preserves the slug, and returns private-safe detail', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    const dataSource = app.get(DataSource);
    await dataSource.getRepository(ArticleFavorite).insert({
      articleId: fixture.articleId,
      userId: fixture.authorId,
    });
    await dataSource.getRepository(Article).update(fixture.articleId, {
      updatedAt: new Date(Date.now() - 1_000),
    });
    const before = await dataSource
      .getRepository(Article)
      .findOneByOrFail({ id: fixture.articleId });
    authenticateAs(app, fixture.authorUsername);

    const response = await request(app.getHttpServer())
      .put(`/api/articles/${fixture.slug}`)
      .set('Authorization', 'Token test-token')
      .send({ article: { title: 'Renamed article', body: 'Updated body' } })
      .expect(200);

    expect(response.body.article).toMatchObject({
      slug: fixture.slug,
      title: 'Renamed article',
      description: 'Detail description',
      body: 'Updated body',
      tagList: fixture.tags,
      favorited: true,
      favoritesCount: 1,
      author: {
        username: fixture.authorUsername,
        bio: 'Public bio',
        image: null,
        following: false,
      },
    });
    expect(response.body.article.createdAt).toBe(before.createdAt.toISOString());
    expect(Date.parse(response.body.article.updatedAt)).toBeGreaterThan(
      before.updatedAt.getTime(),
    );
    expect(response.body.article.author).not.toHaveProperty('email');
    expect(response.body.article.author).not.toHaveProperty('passwordHash');
    expect(response.body.article.author).not.toHaveProperty('id');

    const persisted = await dataSource
      .getRepository(Article)
      .findOneByOrFail({ id: fixture.articleId });
    expect(persisted.slug).toBe(fixture.slug);
    expect(persisted.body).toBe('Updated body');
  });

  it('replaces tags in first-seen order, clears them, and persists both changes through GET', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    const first = `${fixture.tags[0]}-replacement-first`;
    const second = `${fixture.tags[0]}-replacement-second`;
    const caseDistinct = first.toUpperCase();
    replacementTagNames.push(first, second, caseDistinct);
    authenticateAs(app, fixture.authorUsername);

    const replacement = await request(app.getHttpServer())
      .put(`/api/articles/${fixture.slug}`)
      .set('Authorization', 'Token test-token')
      .send({
        article: {
          tagList: [second, first, caseDistinct, second, first, caseDistinct],
        },
      })
      .expect(200);
    expect(replacement.body.article.tagList).toEqual([
      second,
      first,
      caseDistinct,
    ]);

    const persistedReplacement = await request(app.getHttpServer())
      .get(`/api/articles/${fixture.slug}`)
      .set('Authorization', 'Token test-token')
      .expect(200);
    expect(persistedReplacement.body.article.tagList).toEqual([
      second,
      first,
      caseDistinct,
    ]);

    const cleared = await request(app.getHttpServer())
      .put(`/api/articles/${fixture.slug}`)
      .set('Authorization', 'Token test-token')
      .send({ article: { tagList: [] } })
      .expect(200);
    expect(cleared.body.article.tagList).toEqual([]);

    const persistedClear = await request(app.getHttpServer())
      .get(`/api/articles/${fixture.slug}`)
      .set('Authorization', 'Token test-token')
      .expect(200);
    expect(persistedClear.body.article.tagList).toEqual([]);
  });

  it('does not advance updatedAt for empty or identical tag-list updates', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    fixture = await createArticleFixture(app.get(DataSource));
    const dataSource = app.get(DataSource);
    const before = await dataSource
      .getRepository(Article)
      .findOneByOrFail({ id: fixture.articleId });
    authenticateAs(app, fixture.authorUsername);

    const response = await request(app.getHttpServer())
      .put(`/api/articles/${fixture.slug}`)
      .set('Authorization', 'Token test-token')
      .send({ article: {} })
      .expect(200);

    expect(response.body.article).toMatchObject({
      slug: fixture.slug,
      title: 'Article detail',
      description: 'Detail description',
      body: 'Detail body',
      tagList: fixture.tags,
      favorited: false,
      favoritesCount: 0,
      author: {
        username: fixture.authorUsername,
        bio: 'Public bio',
        image: null,
        following: false,
      },
    });
    expect(response.body.article.updatedAt).toBe(before.updatedAt.toISOString());

    const identicalTags = await request(app.getHttpServer())
      .put(`/api/articles/${fixture.slug}`)
      .set('Authorization', 'Token test-token')
      .send({ article: { tagList: [...fixture.tags] } })
      .expect(200);
    expect(identicalTags.body.article.tagList).toEqual(fixture.tags);
    expect(identicalTags.body.article.updatedAt).toBe(
      before.updatedAt.toISOString(),
    );

    const unchanged = await dataSource
      .getRepository(Article)
      .findOneByOrFail({ id: fixture.articleId });
    expect(unchanged.updatedAt.toISOString()).toBe(
      before.updatedAt.toISOString(),
    );
  });
});
