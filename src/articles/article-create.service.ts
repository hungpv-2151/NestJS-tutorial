import { Injectable } from '@nestjs/common';
import { DataSource, In, type EntityManager } from 'typeorm';

import { User } from '../users/user.entity.js';
import { ArticleTag } from './article-tag.entity.js';
import { Article } from './article.entity.js';
import {
  serializeArticleDetail,
  type ArticleSerializationInput,
} from './article.serializer.js';
import { createArticleSlug } from './article-create-slug.js';
import { Tag } from '../tags/tag.entity.js';
import type { NewArticleDto } from './article-create.dto.js';

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';
const ARTICLE_SLUG_UNIQUE_CONSTRAINT = 'uq_articles_slug';

export class ArticleAuthorNotFoundError extends Error {}
export class ArticleSlugConflictError extends Error {}
export class ArticleTagPersistenceError extends Error {}
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
        const tags = uniqueTags(request.tagList ?? []);
        await this.saveTags(manager, article.id, tags);

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

  private async saveTags(
    manager: EntityManager,
    articleId: string,
    names: string[],
  ): Promise<void> {
    if (names.length === 0) return;

    await manager
      .getRepository(Tag)
      .createQueryBuilder()
      .insert()
      .values(names.map((name) => ({ name })))
      .orIgnore()
      .execute();

    const storedTags = await manager
      .getRepository(Tag)
      .findBy({ name: In(names) });
    const tagIds = new Map(storedTags.map(({ name, id }) => [name, id]));
    const articleTags = names.map((name, position) => {
      const tagId = tagIds.get(name);
      if (!tagId) {
        throw new ArticleTagPersistenceError(
          'tag insert did not return a persisted row',
        );
      }
      return { articleId, tagId, position };
    });
    await manager.getRepository(ArticleTag).insert(articleTags);
  }
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags)];
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
