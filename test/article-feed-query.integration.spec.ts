import { randomUUID } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { Article } from '../src/articles/article.entity.js';
import { UserFollow } from '../src/profiles/user-follow.entity.js';
import { User } from '../src/users/user.entity.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? it : it.skip;
const fixture = { usernames: [] as string[], slugs: [] as string[] };
let dataSource: DataSource | undefined;

describe('article feed query (PostgreSQL integration)', () => {
  beforeAll(async () => {
    if (!databaseUrl) return;
    dataSource = new DataSource({ type: 'postgres', url: databaseUrl, entities: [User, Article, UserFollow] });
    await dataSource.initialize();
  });

  afterEach(async () => {
    if (!dataSource) return;
    await dataSource.getRepository(UserFollow).delete({ followerId: In(fixtureUserIds) });
    await dataSource.getRepository(Article).delete({ slug: In(fixture.slugs) });
    await dataSource.getRepository(User).delete({ username: In(fixture.usernames) });
    fixture.usernames.length = 0;
    fixture.slugs.length = 0;
    fixtureUserIds.length = 0;
  });

  afterAll(async () => dataSource?.destroy());

  integration('filters by viewer follows, deduplicates counts, and pages stable timestamp ties', async () => {
    const suffix = randomUUID();
    const viewer = await createUser(`feed-viewer-${suffix}`);
    const authorA = await createUser(`feed-author-a-${suffix}`);
    const authorB = await createUser(`feed-author-b-${suffix}`);
    const stranger = await createUser(`feed-stranger-${suffix}`);
    fixtureUserIds.push(viewer.id);
    const { ArticleListQueryService } = await import('../src/articles/article-list-query.service.js');
    const service = new ArticleListQueryService(requireDataSource());
    const criteria = { followedByUserId: viewer.id, offset: 0, limit: 10 };
    expect(await service.list(criteria)).toEqual({ articles: [], articlesCount: 0 });

    await requireDataSource().getRepository(UserFollow).insert([
      { followerId: viewer.id, followingId: authorA.id },
      { followerId: viewer.id, followingId: authorB.id },
    ]);

    const timestamp = new Date('2026-01-02T03:04:05.000Z');
    const prefix = randomUUID().slice(0, 24);
    const rows = await requireDataSource().getRepository(Article).save([
      article(`${prefix}000000000001`, `feed-a-${suffix}`, authorA, timestamp),
      article(`${prefix}000000000002`, `feed-b-${suffix}`, authorB, timestamp),
      article(`${prefix}000000000003`, `feed-stranger-${suffix}`, stranger, timestamp),
      article(`${prefix}000000000004`, `feed-own-${suffix}`, viewer, timestamp),
    ]);
    fixture.slugs.push(...rows.map(({ slug }) => slug));

    const all = await service.list(criteria);
    const first = await service.list({ ...criteria, limit: 1 });
    const second = await service.list({ ...criteria, offset: 1, limit: 1 });
    const pastEnd = await service.list({ ...criteria, offset: 2, limit: 1 });

    expect(all.articlesCount).toBe(2);
    expect(all.articles.map(({ id }) => id)).toEqual([rows[1].id, rows[0].id]);
    expect(new Set(all.articles.map(({ id }) => id)).size).toBe(2);
    expect(first.articles.map(({ id }) => id)).toEqual([rows[1].id]);
    expect(second.articles.map(({ id }) => id)).toEqual([rows[0].id]);
    expect(pastEnd).toEqual({ articles: [], articlesCount: 2 });
    await requireDataSource().getRepository(UserFollow).delete({ followerId: viewer.id, followingId: authorA.id });
    expect((await service.list(criteria)).articlesCount).toBe(1);
  });
});

const fixtureUserIds: string[] = [];

function article(id: string, slug: string, author: User, createdAt: Date) {
  fixture.slugs.push(slug);
  return { id, slug, title: slug, description: 'Feed query fixture', body: 'private', authorId: author.id, createdAt, updatedAt: createdAt };
}

async function createUser(username: string): Promise<User> {
  fixture.usernames.push(username);
  return requireDataSource().getRepository(User).save({ username, email: `${username}@example.test`, passwordHash: 'integration-test-only-hash' });
}

function requireDataSource(): DataSource {
  if (!dataSource) throw new Error('integration database is unavailable');
  return dataSource;
}
