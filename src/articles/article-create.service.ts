import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { User } from '../users/user.entity.js';
import { Article } from './article.entity.js';
import {
  serializeArticleDetail,
  type ArticleSerializationInput,
} from './article.serializer.js';
import { createArticleSlug } from './article-create-slug.js';
import type { NewArticleDto } from './article-create.dto.js';
import { persistArticleTags } from './article-tag-persistence.js';

export { ArticleTagPersistenceError } from './article-tag-persistence.js';

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';
const ARTICLE_SLUG_UNIQUE_CONSTRAINT = 'uq_articles_slug';

export class ArticleAuthorNotFoundError extends Error {}
export class ArticleSlugConflictError extends Error {}
export class ArticleCreatePersistenceError extends Error {
  constructor(cause: unknown) {
    super('article could not be created', { cause });
  }
}

@Injectable()
export class ArticleCreateService {
  constructor(private readonly dataSource: DataSource) {}

  async create(username: string, request: NewArticleDto) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const author = await manager
          .getRepository(User)
          .findOneBy({ username });
        if (!author) throw new ArticleAuthorNotFoundError();

        const articleRepository = manager.getRepository(Article);
        const article = await articleRepository.save(
          articleRepository.create({
            body: request.body,
            authorId: author.id,
            description: request.description,
            slug: createArticleSlug(request.title),
            title: request.title,
          }),
        );
        const tags = await persistArticleTags(
          manager,
          article.id,
          request.tagList ?? [],
        );

        const serializedInput: ArticleSerializationInput = {
          ...article,
          author,
          context: {
            authorFollowing: false,
            favorited: false,
            favoritesCount: 0,
            tags,
          },
        };
        return serializeArticleDetail(serializedInput);
      });
    } catch (error) {
      if (error instanceof ArticleAuthorNotFoundError) throw error;
      if (isSlugConflict(error)) throw new ArticleSlugConflictError();
      throw new ArticleCreatePersistenceError(error);
    }
  }
}

function isSlugConflict(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const driverError = isRecord(error.driverError) ? error.driverError : error;
  return (
    driverError.code === POSTGRES_UNIQUE_VIOLATION_CODE &&
    driverError.constraint === ARTICLE_SLUG_UNIQUE_CONSTRAINT
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
