import { describe, expect, it, vi } from 'vitest';
import { DataSource, type EntityManager } from 'typeorm';

import { Article } from '../../../src/articles/article.entity.js';
import { User } from '../../../src/users/user.entity.js';
import { Comment } from '../../../src/comments/comment.entity.js';
import {
  CommentArticleNotFoundError,
  CommentPersistenceError,
  CommentService,
  CommentUserNotFoundError,
} from '../../../src/comments/comment.service.js';

describe('CommentService', () => {
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
    const userError = await missingUserHarness.service
      .create('article-slug', 'writer', 'body')
      .catch((error: unknown) => error);
    expect(userError).toBeInstanceOf(CommentUserNotFoundError);
    expect((userError as CommentUserNotFoundError).getStatus()).toBe(401);
    expect((userError as CommentUserNotFoundError).getResponse()).toEqual({
      errors: { token: ['is invalid'] },
    });

    const missingArticleHarness = createHarness();
    missingArticleHarness.findArticle.mockResolvedValue(null);
    const articleError = await missingArticleHarness.service
      .create('missing', 'writer', 'body')
      .catch((error: unknown) => error);
    expect(articleError).toBeInstanceOf(CommentArticleNotFoundError);
    expect((articleError as CommentArticleNotFoundError).getStatus()).toBe(404);
    expect((articleError as CommentArticleNotFoundError).getResponse()).toEqual(
      { errors: { article: ['not found'] } },
    );
  });

  it('uses the shared article not-found error when listing an unknown slug', async () => {
    const manager = {
      getRepository: () => ({ findOne: async () => null }),
    } as unknown as EntityManager;
    const service = new CommentService({
      transaction: async (
        _isolationLevel: string,
        work: (manager: EntityManager) => Promise<unknown>,
      ) => work(manager),
    } as unknown as DataSource);

    await expect(service.list('missing')).rejects.toBeInstanceOf(
      CommentArticleNotFoundError,
    );
  });

  it('wraps persistence failures with the original cause', async () => {
    const harness = createHarness();
    const databaseError = new Error('database unavailable');
    harness.saveComment.mockRejectedValue(databaseError);

    const error = await harness.service
      .create('article-slug', 'writer', 'body')
      .catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(CommentPersistenceError);
    expect((error as CommentPersistenceError).getStatus()).toBe(500);
    expect((error as CommentPersistenceError).getResponse()).toEqual({
      errors: { body: ['request failed'] },
    });
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
  const service = new CommentService({
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
