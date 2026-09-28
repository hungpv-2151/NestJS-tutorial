import { randomUUID } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { Article } from '../src/articles/article.entity.js';
import { ArticleFavorite } from '../src/articles/article-favorite.entity.js';
import { ArticleTag } from '../src/articles/article-tag.entity.js';
import { Tag } from '../src/tags/tag.entity.js';
import { User } from '../src/users/user.entity.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? it : it.skip;
const fixture = { usernames: [] as string[], slugs: [] as string[], tags: [] as string[] };
let dataSource: DataSource | undefined;

describe('article list query foundation', () => {
  beforeAll(async () => {
    if (!databaseUrl) return;
    dataSource = new DataSource({
      type: 'postgres',
      url: databaseUrl,
      entities: [User, Article, ArticleTag, ArticleFavorite, Tag],
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    if (!dataSource) return;
    await dataSource.getRepository(Article).delete({ slug: In(fixture.slugs) });
    await dataSource.getRepository(Tag).delete({ name: In(fixture.tags) });
    await dataSource.getRepository(User).delete({ username: In(fixture.usernames) });
    fixture.usernames.length = 0;
    fixture.slugs.length = 0;
    fixture.tags.length = 0;
  });

  afterAll(async () => dataSource?.destroy());

  integration('combines filters, counts distinct matches before paging, and orders timestamp ties by id', async () => {
    const suffix = randomUUID();
    const author = await createUser(`list-author-${suffix}`);
    const otherAuthor = await createUser(`list-other-${suffix}`);
    const favorite = await createUser(`list-favorite-${suffix}`);
    const otherFavorite = await createUser(`list-other-favorite-${suffix}`);
    const tagA = await createTag(`list-a-${suffix}`);
    const tagB = await createTag(`list-b-${suffix}`);
    const tagOther = await createTag(`list-other-${suffix}`);
    const timestamp = new Date('2026-01-02T03:04:05.000Z');
    const articleIdPrefix = randomUUID().slice(0, 24);
    const articles = await requireDataSource().getRepository(Article).save([
      makeArticle(idFor(articleIdPrefix, 1), `list-one-${suffix}`, author, timestamp),
      makeArticle(idFor(articleIdPrefix, 2), `list-two-${suffix}`, author, timestamp),
      makeArticle(idFor(articleIdPrefix, 3), `list-wrong-favorite-${suffix}`, author, timestamp),
      makeArticle(idFor(articleIdPrefix, 4), `list-wrong-author-${suffix}`, otherAuthor, timestamp),
      makeArticle(idFor(articleIdPrefix, 5), `list-wrong-tag-${suffix}`, author, timestamp),
    ]);
    fixture.slugs.push(...articles.map(({ slug }) => slug));
    await requireDataSource().getRepository(ArticleTag).insert([
      { articleId: articles[0].id, tagId: tagA.id, position: 0 },
      { articleId: articles[0].id, tagId: tagB.id, position: 1 },
      { articleId: articles[1].id, tagId: tagA.id, position: 0 },
      { articleId: articles[2].id, tagId: tagA.id, position: 0 },
      { articleId: articles[3].id, tagId: tagA.id, position: 0 },
      { articleId: articles[4].id, tagId: tagOther.id, position: 0 },
    ]);
    await requireDataSource().getRepository(ArticleFavorite).insert([
      { articleId: articles[0].id, userId: favorite.id },
      { articleId: articles[0].id, userId: otherFavorite.id },
      { articleId: articles[1].id, userId: favorite.id },
      { articleId: articles[2].id, userId: otherFavorite.id },
      { articleId: articles[3].id, userId: favorite.id },
      { articleId: articles[4].id, userId: favorite.id },
    ]);

    const { ArticleListQueryService } = await import('../src/articles/article-list-query.service.js');
    const service = new ArticleListQueryService(requireDataSource());
    const criteria = {
      tag: tagA.name,
      authorUsername: author.username,
      favoritedUsername: favorite.username,
    };

    const tagMatches = await service.list({ tag: tagA.name, offset: 0, limit: 10 });
    const authorMatches = await service.list({ authorUsername: author.username, offset: 0, limit: 10 });
    const favoriteMatches = await service.list({ favoritedUsername: favorite.username, offset: 0, limit: 10 });
    const unfiltered = await service.list({ offset: 0, limit: 10 });
    const first = await service.list({ ...criteria, offset: 0, limit: 1 });
    const second = await service.list({ ...criteria, offset: 1, limit: 1 });
    const pastEnd = await service.list({ ...criteria, offset: 2, limit: 1 });
    const noMatch = await service.list({ ...criteria, tag: `absent-${suffix}`, offset: 0, limit: 10 });

    expect(tagMatches.articlesCount).toBe(4);
    expect(tagMatches.articles.map(({ id }) => id)).toHaveLength(4);
    expect(authorMatches.articlesCount).toBe(4);
    expect(favoriteMatches.articlesCount).toBe(4);
    expect(unfiltered.articles.map(({ id }) => id)).toEqual(
      expect.arrayContaining(articles.map(({ id }) => id)),
    );
    expect(unfiltered.articles.find(({ id }) => id === articles[0].id)?.author.username).toBe(author.username);
    expect(first.articlesCount).toBe(2);
    expect(first.articles.map(({ id }) => id)).toEqual([articles[1].id]);
    expect(first.articles[0].body).toBeUndefined();
    expect(second.articlesCount).toBe(2);
    expect(second.articles.map(({ id }) => id)).toEqual([articles[0].id]);
    expect(pastEnd).toEqual({ articles: [], articlesCount: 2 });
    expect(noMatch).toEqual({ articles: [], articlesCount: 0 });
  });
});

function makeArticle(id: string, slug: string, author: User, createdAt: Date) {
  return {
    id,
    slug,
    title: slug,
    description: 'List query fixture',
    body: 'List query fixture body',
    authorId: author.id,
    createdAt,
    updatedAt: createdAt,
  };
}

function idFor(prefix: string, order: number): string {
  return `${prefix}${String(order).padStart(12, '0')}`;
}

async function createUser(username: string): Promise<User> {
  fixture.usernames.push(username);
  return requireDataSource().getRepository(User).save({
    username,
    email: `${username}@example.test`,
    passwordHash: 'integration-test-only-hash',
  });
}

async function createTag(name: string): Promise<Tag> {
  fixture.tags.push(name);
  return requireDataSource().getRepository(Tag).save({ name });
}

function requireDataSource(): DataSource {
  if (!dataSource) throw new Error('integration database is unavailable');
  return dataSource;
}
