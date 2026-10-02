import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';

import { ArticleFavorite } from '../src/articles/article-favorite.entity.js';
import { Article } from '../src/articles/article.entity.js';
import { UserFollow } from '../src/profiles/user-follow.entity.js';
import { createApp } from '../src/create-app.js';
import {
  authenticateAs,
  cleanArticleFixture,
  createArticleFixture,
  type ArticleFixture,
} from './article-detail-fixture.js';

const integration = process.env.TEST_DATABASE_URL ? it : it.skip;

describe('article list batch hydration (PostgreSQL integration)', () => {
  let app: INestApplication;
  let fixture: ArticleFixture | undefined;

  afterEach(async () => {
    try {
      if (app && fixture) await cleanArticleFixture(app.get(DataSource), fixture);
    } finally {
      await app?.close();
      fixture = undefined;
    }
  });

  integration('hydrates the same rows while keeping SQL query count fixed for page sizes 1 and 3', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    const dataSource = app.get(DataSource);
    fixture = await createArticleFixture(dataSource);
    const extra = [1, 2].map((index) => ({
      slug: `list-hydration-${randomUUID()}`,
      title: `Hydration ${index}`,
      description: 'Hydration query count fixture',
      body: 'Hydration fixture body',
      authorId: fixture!.authorId,
    }));
    const stored = await dataSource.getRepository(Article).save(extra);
    await dataSource.getRepository(ArticleFavorite).insert({
      articleId: fixture.articleId,
      userId: fixture.viewerId,
    });
    await dataSource.getRepository(UserFollow).insert({
      followerId: fixture.viewerId,
      followingId: fixture.authorId,
    });

    const isLogEnabled = vi.spyOn(dataSource.logger, 'isLogEnabledFor').mockReturnValue(true);
    const logQuery = vi.spyOn(dataSource.logger, 'logQuery').mockImplementation(() => undefined);
    const countFor = async (limit: number, authenticated: boolean) => {
      if (authenticated) authenticateAs(app, fixture!.viewerUsername);
      logQuery.mockClear();
      const listRequest = request(app.getHttpServer())
        .get('/api/articles')
        .query({ author: fixture!.authorUsername, limit });
      if (authenticated) listRequest.set('Authorization', 'Token test-token');
      const response = await listRequest;
      expect(response.status).toBe(200);
      return {
        count: logQuery.mock.calls.length,
        queries: logQuery.mock.calls.map(([query]) => query),
        articles: response.body.articles,
      };
    };

    try {
      for (const authenticated of [false, true]) {
        const one = await countFor(1, authenticated);
        const three = await countFor(3, authenticated);
        expect(three.count).toBe(one.count);
        const pageQuery = three.queries.find(isArticlePageQuery);
        expect(pageQuery).toBeDefined();
        expect(selectList(pageQuery!)).not.toMatch(
          /(?:^|[.,\s])(?:"?article"?\.)?"?body"?(?=\s*(?:,|$))/i,
        );
        expect(three.articles).toHaveLength(3);
        expect(three.articles.map((article: { slug: string }) => article.slug)).toEqual(
          expect.arrayContaining([fixture.slug, ...stored.map(({ slug }) => slug)]),
        );
        const original = three.articles.find(
          (article: { slug: string }) => article.slug === fixture!.slug,
        );
        expect(original.tagList).toEqual(fixture.tags);
        expect(original.favoritesCount).toBe(1);
        expect(original.favorited).toBe(authenticated);
        expect(original.author.following).toBe(authenticated);
      }
    } finally {
      isLogEnabled.mockRestore();
      logQuery.mockRestore();
    }
  });
});

function isArticlePageQuery(query: string): boolean {
  return /\bFROM\s+"?articles"?\s+"?article"?/i.test(query) &&
    !/\bCOUNT\s*\(\s*DISTINCT\b/i.test(query);
}

function selectList(query: string): string {
  const fromIndex = query.search(/\bFROM\b/i);
  return fromIndex < 0 ? query : query.slice(0, fromIndex);
}
