import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { User } from '../users/user.entity.js';
import { ArticleFavorite } from './article-favorite.entity.js';
import { ArticleReadService } from './article-read.service.js';
import { Article } from './article.entity.js';

export class ArticleFavoriteDeleteUserNotFoundError extends Error {}
export class ArticleFavoriteDeleteArticleNotFoundError extends Error {}
export class ArticleFavoriteDeletePersistenceError extends Error {
  constructor(cause: unknown) {
    super('article favorite could not be deleted', { cause });
  }
}

@Injectable()
export class ArticleFavoriteDeleteService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly articleReadService: ArticleReadService,
  ) {}

  async delete(slug: string, username: string) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const viewer = await manager.getRepository(User).findOne({
          where: { username },
          lock: { mode: 'pessimistic_write' },
        });
        if (!viewer) throw new ArticleFavoriteDeleteUserNotFoundError();

        const article = await manager.getRepository(Article).findOne({
          where: { slug },
          lock: { mode: 'pessimistic_write' },
        });
        if (!article) throw new ArticleFavoriteDeleteArticleNotFoundError();

        await manager.getRepository(ArticleFavorite).delete({
          articleId: article.id,
          userId: viewer.id,
        });

        return await this.articleReadService.getBySlug(slug, username, manager);
      });
    } catch (error) {
      if (isExpectedFavoriteDeleteError(error)) throw error;
      throw new ArticleFavoriteDeletePersistenceError(error);
    }
  }
}

function isExpectedFavoriteDeleteError(error: unknown): boolean {
  return (
    error instanceof ArticleFavoriteDeleteUserNotFoundError ||
    error instanceof ArticleFavoriteDeleteArticleNotFoundError
  );
}
