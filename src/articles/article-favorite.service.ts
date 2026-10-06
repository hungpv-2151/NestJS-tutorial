import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { User } from '../users/user.entity.js';
import { ArticleFavorite } from './article-favorite.entity.js';
import { ArticleReadService } from './article-read.service.js';
import { Article } from './article.entity.js';

export class ArticleFavoriteUserNotFoundError extends UnauthorizedException {
  constructor() {
    super({ errors: { token: ['is invalid'] } });
  }
}

export class ArticleFavoriteArticleNotFoundError extends NotFoundException {
  constructor() {
    super({ errors: { article: ['not found'] } });
  }
}

export class ArticleFavoriteCreatePersistenceError extends InternalServerErrorException {
  constructor(cause: unknown) {
    super({ errors: { body: ['request failed'] } }, { cause });
  }
}

@Injectable()
export class ArticleFavoriteService {
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
        if (!viewer) throw new ArticleFavoriteUserNotFoundError();

        const article = await manager.getRepository(Article).findOne({
          where: { slug },
          lock: { mode: 'pessimistic_write' },
        });
        if (!article) throw new ArticleFavoriteArticleNotFoundError();

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
    error instanceof ArticleFavoriteUserNotFoundError ||
    error instanceof ArticleFavoriteArticleNotFoundError
  );
}
