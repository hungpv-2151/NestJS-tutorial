import { describe, expect, it, vi } from 'vitest';

import { User } from '../../../src/users/user.entity.js';
import { Article } from '../../../src/articles/article.entity.js';
import {
  ArticleDeleteArticleNotFoundError,
  ArticleDeleteForbiddenError,
  ArticleDeletePersistenceError,
  ArticleDeleteService,
  ArticleDeleteUserNotFoundError,
} from '../../../src/articles/article-delete.service.js';

function createHarness(options?: {
  user?: { id: string } | null;
  article?: { id: string; authorId: string } | null;
  deleteError?: Error;
}) {
  const userRepository = {
    findOneBy: vi
      .fn()
      .mockResolvedValue(
        options?.user === null ? null : (options?.user ?? { id: 'owner-id' }),
      ),
  };
  const articleRepository = {
    findOne: vi
      .fn()
      .mockResolvedValue(
        options?.article === null
          ? null
          : (options?.article ?? { id: 'article-id', authorId: 'owner-id' }),
      ),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
  };
  if (options?.deleteError)
    articleRepository.delete.mockRejectedValue(options.deleteError);
  const manager = {
    getRepository: vi.fn((entity: typeof User | typeof Article) =>
      entity === User ? userRepository : articleRepository,
    ),
  };
  const transaction = vi.fn((callback: (value: typeof manager) => unknown) =>
    callback(manager),
  );
  const service = new ArticleDeleteService({ transaction } as never);
  return { articleRepository, manager, service, transaction, userRepository };
}

describe('ArticleDeleteService', () => {
  it('rejects a missing JWT subject user with a typed error', async () => {
    const { service } = createHarness({ user: null });

    await expect(service.delete('slug', 'missing-user')).rejects.toBeInstanceOf(
      ArticleDeleteUserNotFoundError,
    );
  });

  it('rejects an unknown article with a typed error', async () => {
    const { service } = createHarness({ article: null });

    await expect(service.delete('unknown', 'owner')).rejects.toBeInstanceOf(
      ArticleDeleteArticleNotFoundError,
    );
  });

  it('rejects a non-owner before deleting', async () => {
    const { articleRepository, service } = createHarness({
      user: { id: 'other-id' },
    });

    await expect(service.delete('slug', 'other')).rejects.toBeInstanceOf(
      ArticleDeleteForbiddenError,
    );
    expect(articleRepository.delete).not.toHaveBeenCalled();
  });

  it('deletes the owned row inside the transaction', async () => {
    const { articleRepository, service, transaction, userRepository } =
      createHarness();

    await expect(service.delete('slug', 'owner')).resolves.toBeUndefined();

    expect(transaction).toHaveBeenCalledOnce();
    expect(userRepository.findOneBy).toHaveBeenCalledWith({
      username: 'owner',
    });
    expect(articleRepository.findOne).toHaveBeenCalledWith({
      where: { slug: 'slug' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(articleRepository.delete).toHaveBeenCalledWith({ id: 'article-id' });
  });

  it('wraps unexpected database failures in a typed persistence error', async () => {
    const databaseFailure = new Error('driver details');
    const { service } = createHarness({ deleteError: databaseFailure });

    await expect(service.delete('slug', 'owner')).rejects.toMatchObject({
      constructor: ArticleDeletePersistenceError,
      cause: databaseFailure,
      message: 'article could not be deleted',
    });
  });
});
