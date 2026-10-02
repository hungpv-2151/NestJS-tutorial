import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { User } from '../users/user.entity.js';
import {
  ArticleListQueryService,
  ArticleListQueryValidationError,
  type ArticleListQueryCriteria,
} from './article-list-query.service.js';
import { ArticleListHydrator } from './article-list-hydrator.js';
import { serializeArticleList } from './article.serializer.js';

export class ArticleListViewerNotFoundError extends Error {}

export class ArticleListPersistenceError extends Error {
  constructor(cause?: unknown) {
    super('Could not load articles', { cause });
    this.name = ArticleListPersistenceError.name;
  }
}

@Injectable()
export class ArticleListService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly queryService: ArticleListQueryService,
    private readonly hydrator: ArticleListHydrator,
  ) {}

  async list(criteria: ArticleListQueryCriteria, viewerUsername?: string) {
    return this.load(criteria, viewerUsername);
  }

  async feed(criteria: ArticleListQueryCriteria, viewerUsername: string) {
    return this.load(criteria, viewerUsername, true);
  }

  private async load(
    criteria: ArticleListQueryCriteria,
    viewerUsername?: string,
    followedAuthorsOnly = false,
  ) {
    try {
      const viewer = viewerUsername === undefined
        ? undefined
        : await this.dataSource.getRepository(User).findOne({
            select: { id: true },
            where: { username: viewerUsername },
          });
      if (viewerUsername !== undefined && !viewer) {
        throw new ArticleListViewerNotFoundError();
      }

      let queryCriteria = criteria;
      if (followedAuthorsOnly) {
        if (!viewer) throw new ArticleListViewerNotFoundError();
        queryCriteria = { ...criteria, followedByUserId: viewer.id };
      }

      const result = await this.queryService.list(queryCriteria);
      if (result.articles.length === 0) {
        return serializeArticleList([], result.articlesCount);
      }
      const articles = await this.hydrator.hydrate(result.articles, viewer?.id);
      return serializeArticleList(articles, result.articlesCount);
    } catch (error) {
      if (error instanceof ArticleListQueryValidationError ||
          error instanceof ArticleListViewerNotFoundError ||
          error instanceof ArticleListPersistenceError) throw error;
      throw new ArticleListPersistenceError(error);
    }
  }
}
