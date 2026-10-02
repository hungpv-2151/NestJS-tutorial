import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { User } from '../users/user.entity.js';
import { ArticleFavorite } from './article-favorite.entity.js';
import { ArticleReadService } from './article-read.service.js';
import { Article } from './article.entity.js';

export class ArticleFavoriteCreateUserNotFoundError extends Error {}
export class ArticleFavoriteCreateArticleNotFoundError extends Error {}
export class ArticleFavoriteCreatePersistenceError extends Error {
  constructor(cause: unknown) {
    super('article favorite could not be created', { cause });
  }
}

@Injectable()
export class ArticleFavoriteCreateService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly articleReadService: ArticleReadService,
  ) {}

  async create(slug: string, username: string) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const viewer = await manager.getRepository(User).findOne({
          where: { username },
          lock: { mode: 'pessimistic_write' },
        });
        if (!viewer) throw new ArticleFavoriteCreateUserNotFoundError();

        const article = await manager.getRepository(Article).findOne({
          where: { slug },
          lock: { mode: 'pessimistic_write' },
        });
        if (!article) throw new ArticleFavoriteCreateArticleNotFoundError();

        await manager
          .getRepository(ArticleFavorite)
          .createQueryBuilder()
          .insert()
          .values({ articleId: article.id, userId: viewer.id })
          .orIgnore()
          .execute();

        return await this.articleReadService.getBySlug(slug, username, manager);
      });
    } catch (error) {
      if (isExpectedFavoriteCreateError(error)) throw error;
      throw new ArticleFavoriteCreatePersistenceError(error);
    }
  }
}

function isExpectedFavoriteCreateError(error: unknown): boolean {
  return (
    error instanceof ArticleFavoriteCreateUserNotFoundError ||
    error instanceof ArticleFavoriteCreateArticleNotFoundError
  );
}
