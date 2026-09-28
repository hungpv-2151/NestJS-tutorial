import { describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';

import { User } from '../users/user.entity.js';
import { UserFollow } from '../profiles/user-follow.entity.js';
import { Tag } from '../tags/tag.entity.js';
import { ArticleFavorite } from './article-favorite.entity.js';
import { ArticleTag } from './article-tag.entity.js';
import { Article } from './article.entity.js';
import {
  ArticleNotFoundError,
  ArticleReadService,
  ArticleViewerNotFoundError,
} from './article-read.service.js';

describe('ArticleReadService', () => {
  it('serializes a guest detail from ordered tags and an aggregate favorite count', async () => {
    const fixture = createFixture({ favoriteCount: 4 });

    const result = await fixture.service.getBySlug('article-slug');

    expect(result.article).toMatchObject({
      slug: 'article-slug',
      tagList: ['first', 'second'],
      favorited: false,
      favoritesCount: 4,
      author: { username: 'writer', following: false },
    });
    expect(fixture.favoriteCount).toHaveBeenCalledWith({
      articleId: 'article-id',
    });
    expect(fixture.tagOrderBy).toHaveBeenCalledWith(
      'articleTag.position',
      'ASC',
    );
    expect(fixture.viewerLookup).not.toHaveBeenCalled();
    expect(fixture.favoriteLookup).not.toHaveBeenCalled();
    expect(fixture.followLookup).not.toHaveBeenCalled();
  });

  it('throws a typed error before reading related state for an unknown slug', async () => {
    const fixture = createFixture({ article: null });

    await expect(fixture.service.getBySlug('missing')).rejects.toBeInstanceOf(
      ArticleNotFoundError,
    );
    expect(fixture.tagQuery).not.toHaveBeenCalled();
    expect(fixture.favoriteCount).not.toHaveBeenCalled();
  });

  it('maps a deleted viewer to a typed stale-token error', async () => {
    const fixture = createFixture({ viewer: null });

    await expect(
      fixture.service.getBySlug('article-slug', 'deleted-user'),
    ).rejects.toBeInstanceOf(ArticleViewerNotFoundError);
    expect(fixture.viewerLookup).toHaveBeenCalledWith({
      username: 'deleted-user',
    });
  });

  it('includes the authenticated viewer favorite and follow state with fixed lookups', async () => {
    const fixture = createFixture({ favorite: true, follow: true });

    const result = await fixture.service.getBySlug('article-slug', 'reader');

    expect(result.article.favorited).toBe(true);
    expect(result.article.favoritesCount).toBe(2);
    expect(result.article.author.following).toBe(true);
    expect(fixture.favoriteLookup).toHaveBeenCalledWith({
      articleId: 'article-id',
      userId: 'reader-id',
    });
    expect(fixture.followLookup).toHaveBeenCalledWith({
      followerId: 'reader-id',
      followingId: 'author-id',
    });
    expect(fixture.tagQuery).toHaveBeenCalledTimes(1);
    expect(fixture.favoriteCount).toHaveBeenCalledTimes(1);
  });

  it('propagates persistence errors instead of hiding them', async () => {
    const failure = new Error('read failed');
    const fixture = createFixture({ tagError: failure });

    await expect(fixture.service.getBySlug('article-slug')).rejects.toBe(
      failure,
    );
  });
});

function createFixture(
  options: {
    article?: Article | null;
    favoriteCount?: number;
    favorite?: boolean;
    follow?: boolean;
    tagError?: Error;
    viewer?: User | null;
  } = {},
) {
  const author = Object.assign(new User(), {
    id: 'author-id',
    username: 'writer',
    bio: null,
    image: null,
  });
  const article = Object.assign(new Article(), {
    id: 'article-id',
    slug: 'article-slug',
    title: 'Title',
    description: 'Description',
    body: 'Body',
    authorId: 'author-id',
    author,
    createdAt: new Date('2026-09-28T00:00:00.000Z'),
    updatedAt: new Date('2026-09-28T00:00:00.000Z'),
  });
  const articleQuery = chain({
    getOne: vi
      .fn()
      .mockResolvedValue(
        options.article === undefined ? article : options.article,
      ),
  });
  const rawTags = [{ name: 'first' }, { name: 'second' }];
  const tagQuery = chain({
    getRawMany: vi.fn().mockImplementation(async () => {
      if (options.tagError) throw options.tagError;
      return rawTags;
    }),
  });
  const tagQueryBuilder = vi.fn().mockReturnValue(tagQuery);
  const favoriteCount = vi.fn().mockResolvedValue(options.favoriteCount ?? 2);
  const viewerLookup = vi
    .fn()
    .mockResolvedValue(
      options.viewer === undefined
        ? Object.assign(new User(), { id: 'reader-id', username: 'reader' })
        : options.viewer,
    );
  const favoriteLookup = vi
    .fn()
    .mockResolvedValue(
      options.favorite ? Object.assign(new ArticleFavorite(), {}) : null,
    );
  const followLookup = vi
    .fn()
    .mockResolvedValue(
      options.follow ? Object.assign(new UserFollow(), {}) : null,
    );
  const repositories = new Map<unknown, object>([
    [Article, { createQueryBuilder: vi.fn().mockReturnValue(articleQuery) }],
    [ArticleTag, { createQueryBuilder: tagQueryBuilder }],
    [ArticleFavorite, { countBy: favoriteCount, findOneBy: favoriteLookup }],
    [User, { findOneBy: viewerLookup }],
    [UserFollow, { findOneBy: followLookup }],
    [Tag, {}],
  ]);
  const dataSource = {
    getRepository: (entity: unknown) => repositories.get(entity),
  } as unknown as DataSource;
  return {
    service: new ArticleReadService(dataSource),
    favoriteCount,
    favoriteLookup,
    followLookup,
    tagQuery: tagQueryBuilder,
    tagOrderBy: tagQuery.orderBy,
    viewerLookup,
  };
}

function chain<T extends Record<string, unknown>>(terminal: T) {
  const query = {
    ...terminal,
    leftJoinAndSelect: vi.fn(),
    innerJoinAndSelect: vi.fn(),
    innerJoin: vi.fn(),
    select: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
  };
  for (const method of [
    'leftJoinAndSelect',
    'innerJoinAndSelect',
    'innerJoin',
    'select',
    'where',
    'orderBy',
  ] as const) {
    query[method].mockReturnValue(query);
  }
  return query;
}
