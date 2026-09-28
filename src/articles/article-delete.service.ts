import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { User } from '../users/user.entity.js';
import { Article } from './article.entity.js';

export class ArticleDeleteUserNotFoundError extends Error {}
export class ArticleDeleteArticleNotFoundError extends Error {}
export class ArticleDeleteForbiddenError extends Error {}
export class ArticleDeletePersistenceError extends Error {
  constructor(cause: unknown) {
    super('article could not be deleted', { cause });
  }
}

@Injectable()
export class ArticleDeleteService {
  constructor(private readonly dataSource: DataSource) {}

  async delete(slug: string, username: string): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const user = await manager.getRepository(User).findOneBy({ username });
        if (!user) throw new ArticleDeleteUserNotFoundError();

        const articleRepository = manager.getRepository(Article);
        const article = await articleRepository.findOne({
          where: { slug },
          lock: { mode: 'pessimistic_write' },
        });
        if (!article) throw new ArticleDeleteArticleNotFoundError();
        if (article.authorId !== user.id) {
          throw new ArticleDeleteForbiddenError();
        }

        const result = await articleRepository.delete({ id: article.id });
        if (result.affected !== 1) {
          throw new ArticleDeletePersistenceError(
            new Error('locked article delete affected an unexpected row count'),
          );
        }
      });
    } catch (error) {
      if (isExpectedDeleteError(error)) throw error;
      throw new ArticleDeletePersistenceError(error);
    }
  }
}

function isExpectedDeleteError(error: unknown): boolean {
  return (
    error instanceof ArticleDeleteUserNotFoundError ||
    error instanceof ArticleDeleteArticleNotFoundError ||
    error instanceof ArticleDeleteForbiddenError ||
    error instanceof ArticleDeletePersistenceError
  );
}
