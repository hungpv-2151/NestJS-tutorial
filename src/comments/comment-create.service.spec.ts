import { describe, expect, it, vi } from 'vitest';
import { DataSource, type EntityManager } from 'typeorm';

import { Article } from '../articles/article.entity.js';
import { User } from '../users/user.entity.js';
import { Comment } from './comment.entity.js';
import {
  CommentCreateArticleNotFoundError,
  CommentCreatePersistenceError,
  CommentCreateService,
  CommentCreateUserNotFoundError,
} from './comment-create.service.js';

describe('CommentCreateService', () => {
  it('persists trimmed content for the authenticated user and serializes public fields', async () => {
    const harness = createHarness();

    const result = await harness.service.create(
      'article-slug',
      'writer',
      '  A useful comment  ',
    );

    expect(harness.findUser).toHaveBeenCalledWith({ username: 'writer' });
    expect(harness.findArticle).toHaveBeenCalledWith({
      where: { slug: 'article-slug' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(harness.createComment).toHaveBeenCalledWith({
      articleId: 'article-id',
      authorId: 'writer-id',
      body: 'A useful comment',
    });
    expect(result).toEqual({
      id: 17,
      body: 'A useful comment',
      createdAt: '2026-09-29T10:00:00.000Z',
      updatedAt: '2026-09-29T10:00:00.000Z',
      author: {
        bio: 'Writer bio',
        following: false,
        image: 'https://example.test/writer.png',
        username: 'writer',
      },
    });
  });

  it('reports missing authenticated users and articles as typed errors', async () => {
    const missingUserHarness = createHarness();
    missingUserHarness.findUser.mockResolvedValue(null);
    await expect(
      missingUserHarness.service.create('article-slug', 'writer', 'body'),
    ).rejects.toBeInstanceOf(CommentCreateUserNotFoundError);

    const missingArticleHarness = createHarness();
    missingArticleHarness.findArticle.mockResolvedValue(null);
    await expect(
      missingArticleHarness.service.create('missing', 'writer', 'body'),
    ).rejects.toBeInstanceOf(CommentCreateArticleNotFoundError);
  });

  it('wraps persistence failures with the original cause', async () => {
    const harness = createHarness();
    const databaseError = new Error('database unavailable');
    harness.saveComment.mockRejectedValue(databaseError);

    const error = await harness.service
      .create('article-slug', 'writer', 'body')
      .catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(CommentCreatePersistenceError);
    expect(error).toHaveProperty('cause', databaseError);
  });
});

function createHarness() {
  const user = {
    id: 'writer-id',
    username: 'writer',
    bio: 'Writer bio',
    image: 'https://example.test/writer.png',
  } as User;
  const article = { id: 'article-id', slug: 'article-slug' } as Article;
  const timestamp = new Date('2026-09-29T10:00:00.000Z');
  const findUser = vi.fn<() => Promise<User | null>>().mockResolvedValue(user);
  const findArticle = vi
    .fn<() => Promise<Article | null>>()
    .mockResolvedValue(article);
  const createComment = vi.fn((comment: Partial<Comment>) => comment);
  const saveComment = vi.fn(
    async (comment: Partial<Comment>) =>
      ({
        ...comment,
        id: 17,
        createdAt: timestamp,
        updatedAt: timestamp,
      }) as Comment,
  );
  const repositories = new Map<Function, unknown>([
    [User, { findOneBy: findUser }],
    [Article, { findOne: findArticle }],
    [Comment, { create: createComment, save: saveComment }],
  ]);
  const manager = {
    getRepository: (entity: Function) => repositories.get(entity),
  } as unknown as EntityManager;
  const transaction = vi.fn(
    async (work: (manager: EntityManager) => Promise<unknown>) => work(manager),
  );
  const service = new CommentCreateService({
    transaction,
  } as unknown as DataSource);

  return {
    createComment,
    findArticle,
    findUser,
    saveComment,
    service,
    transaction,
  };
}
