import { describe, expect, it } from 'vitest';
import {
  serializeArticleDetail,
  serializeArticleList,
} from './article.serializer.js';
import { User } from '../users/user.entity.js';

const article = {
  slug: 'hello-world',
  title: 'Hello',
  description: 'Description',
  body: 'Body',
  createdAt: new Date('2026-09-01T10:00:00.000Z'),
  updatedAt: new Date('2026-09-02T10:00:00.000Z'),
  author: Object.assign(new User(), {
    username: 'writer',
    bio: 'Bio',
    image: null,
    email: 'private@example.test',
    passwordHash: 'private-hash',
  }),
  context: {
    tags: ['first', 'second'],
    favorited: true,
    favoritesCount: 2,
    authorFollowing: false,
  },
};

describe('article serializers', () => {
  it('serializes detail fields, dates, ordered tags, and public author only', () => {
    expect(serializeArticleDetail(article)).toEqual({
      article: {
        slug: 'hello-world',
        title: 'Hello',
        description: 'Description',
        body: 'Body',
        tagList: ['first', 'second'],
        createdAt: '2026-09-01T10:00:00.000Z',
        updatedAt: '2026-09-02T10:00:00.000Z',
        favorited: true,
        favoritesCount: 2,
        author: {
          username: 'writer',
          bio: 'Bio',
          image: null,
          following: false,
        },
      },
    });
  });

  it('omits body from list items and clamps negative aggregate counts', () => {
    const result = serializeArticleList(
      [{ ...article, context: { ...article.context, favoritesCount: -1 } }],
      7,
    );

    expect(result.articlesCount).toBe(7);
    expect(result.articles[0]).not.toHaveProperty('body');
    expect(result.articles[0].favoritesCount).toBe(0);
  });

  it('serializes a guest article with empty tags and no favorite state', () => {
    const result = serializeArticleDetail({
      ...article,
      context: {
        tags: [],
        favorited: false,
        favoritesCount: 0,
        authorFollowing: false,
      },
    });

    expect(result.article.tagList).toEqual([]);
    expect(result.article.favorited).toBe(false);
    expect(result.article.favoritesCount).toBe(0);
    expect(result.article.author.following).toBe(false);
  });
});
