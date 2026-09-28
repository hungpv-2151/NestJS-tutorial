import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import { User } from '../users/user.entity.js';
import { ArticleTag } from './article-tag.entity.js';
import { Article } from './article.entity.js';
import type { ArticleUpdateDto } from './article-update.dto.js';
import {
  replaceArticleTags,
  uniqueArticleTagNames,
} from './article-tag-persistence.js';
import { ArticleReadService } from './article-read.service.js';

export class ArticleUpdateUserNotFoundError extends Error {}
export class ArticleUpdateArticleNotFoundError extends Error {}
export class ArticleUpdateForbiddenError extends Error {}
export class ArticleUpdatePersistenceError extends Error {
  constructor(cause: unknown) {
    super('article could not be updated', { cause });
  }
}

@Injectable()
export class ArticleUpdateService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly articleReadService: ArticleReadService = new ArticleReadService(
      dataSource,
    ),
  ) {}

  async update(slug: string, username: string, request: ArticleUpdateDto) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const author = await manager
          .getRepository(User)
          .findOneBy({ username });
        if (!author) throw new ArticleUpdateUserNotFoundError();

        const articleRepository = manager.getRepository(Article);
        const article = await articleRepository.findOne({
          where: { slug },
          lock: { mode: 'pessimistic_write' },
        });
        if (!article) throw new ArticleUpdateArticleNotFoundError();
        if (article.authorId !== author.id) {
          throw new ArticleUpdateForbiddenError();
        }

        const scalarChanged = applyScalarChanges(article, request);
        if (scalarChanged) await articleRepository.save(article);

        if (request.tagList !== undefined) {
          const requestedTagNames = uniqueArticleTagNames(request.tagList);
          const existingTagNames = await this.loadOrderedTagNames(
            manager,
            article.id,
          );
          const tagsChanged = !hasSameOrderedTagNames(
            existingTagNames,
            requestedTagNames,
          );
          if (tagsChanged) {
            if (!scalarChanged) await this.touchUpdatedAt(article.id, manager);
            await replaceArticleTags(manager, article.id, requestedTagNames);
          }
        }

        return this.articleReadService.getBySlug(slug, username, manager);
      });
    } catch (error) {
      if (isExpectedUpdateError(error)) throw error;
      throw new ArticleUpdatePersistenceError(error);
    }
  }

  private async touchUpdatedAt(
    articleId: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager
      .getRepository(Article)
      .createQueryBuilder()
      .update(Article)
      .set({ updatedAt: () => 'CURRENT_TIMESTAMP' })
      .where('id = :articleId', { articleId })
      .execute();
  }

  private async loadOrderedTagNames(
    manager: EntityManager,
    articleId: string,
  ): Promise<string[]> {
    const rows = await manager
      .getRepository(ArticleTag)
      .createQueryBuilder('articleTag')
      .innerJoin('articleTag.tag', 'tag')
      .select('tag.name', 'name')
      .where('articleTag.articleId = :articleId', { articleId })
      .orderBy('articleTag.position', 'ASC')
      .getRawMany<{ name: string }>();
    return rows.map(({ name }) => name);
  }
}

function applyScalarChanges(
  article: Article,
  request: ArticleUpdateDto,
): boolean {
  let changed = false;
  if (request.title !== undefined && article.title !== request.title) {
    article.title = request.title;
    changed = true;
  }
  if (
    request.description !== undefined &&
    article.description !== request.description
  ) {
    article.description = request.description;
    changed = true;
  }
  if (request.body !== undefined && article.body !== request.body) {
    article.body = request.body;
    changed = true;
  }
  return changed;
}

function hasSameOrderedTagNames(
  current: readonly string[],
  requested: readonly string[],
) {
  return (
    current.length === requested.length &&
    current.every((name, index) => name === requested[index])
  );
}

function isExpectedUpdateError(error: unknown): boolean {
  return (
    error instanceof ArticleUpdateUserNotFoundError ||
    error instanceof ArticleUpdateArticleNotFoundError ||
    error instanceof ArticleUpdateForbiddenError ||
    error instanceof ArticleUpdatePersistenceError
  );
}
