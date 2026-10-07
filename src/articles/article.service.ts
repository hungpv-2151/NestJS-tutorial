import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import { User } from '../users/user.entity.js';
import { ArticleListHydrator } from './article-list-hydrator.js';
import {
  ArticleListQueryService,
  ArticleListQueryValidationError,
  type ArticleListQueryCriteria,
} from './article-list-query.service.js';
import { UserFollow } from '../profiles/user-follow.entity.js';
import { ArticleFavorite } from './article-favorite.entity.js';
import { ArticleTag } from './article-tag.entity.js';
import { Article } from './article.entity.js';
import {
  serializeArticleDetail,
  type ArticleSerializationInput,
} from '../common/serializers/article.serializer.js';
import { createArticleSlug } from './article-create-slug.js';
import { serializeArticleList } from '../common/serializers/article.serializer.js';
import type { NewArticleDto } from '../common/dto/article.dto.js';
import type { ArticleUpdateDto } from '../common/dto/article.dto.js';
import {
  persistArticleTags,
  replaceArticleTags,
  uniqueArticleTagNames,
} from './article-tag-persistence.js';

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

export class ArticleNotFoundError extends NotFoundException {
  constructor() {
    super({ errors: { article: ['not found'] } });
  }
}

export class ArticleViewerNotFoundError extends UnauthorizedException {
  constructor() {
    super({ errors: { token: ['is invalid'] } });
  }
}

@Injectable()
export class ArticleReadService {
  constructor(private readonly dataSource: DataSource) {}

  async getBySlug(
    slug: string,
    viewerUsername?: string,
    manager?: EntityManager,
  ) {
    const articleRepository = manager
      ? manager.getRepository(Article)
      : this.dataSource.getRepository(Article);
    const article = await articleRepository
      .createQueryBuilder('article')
      .innerJoinAndSelect('article.author', 'author')
      .where('article.slug = :slug', { slug })
      .getOne();
    if (!article) throw new ArticleNotFoundError();

    const viewer = viewerUsername
      ? await (
          manager
            ? manager.getRepository(User)
            : this.dataSource.getRepository(User)
        ).findOneBy({ username: viewerUsername })
      : null;
    if (viewerUsername && !viewer) throw new ArticleViewerNotFoundError();

    if (manager) {
      const tags = await this.loadOrderedTags(article.id, manager);
      const favoritesCount = await manager
        .getRepository(ArticleFavorite)
        .countBy({ articleId: article.id });
      const favorite = viewer
        ? await manager.getRepository(ArticleFavorite).findOneBy({
            articleId: article.id,
            userId: viewer.id,
          })
        : null;
      const follow = viewer
        ? await manager.getRepository(UserFollow).findOneBy({
            followerId: viewer.id,
            followingId: article.authorId,
          })
        : null;
      return this.serializeDetail(
        article,
        tags,
        favoritesCount,
        favorite,
        follow,
      );
    }

    const [tags, favoritesCount, favorite, follow] = await Promise.all([
      this.loadOrderedTags(article.id),
      this.dataSource
        .getRepository(ArticleFavorite)
        .countBy({ articleId: article.id }),
      viewer
        ? this.dataSource.getRepository(ArticleFavorite).findOneBy({
            articleId: article.id,
            userId: viewer.id,
          })
        : Promise.resolve(null),
      viewer
        ? this.dataSource.getRepository(UserFollow).findOneBy({
            followerId: viewer.id,
            followingId: article.authorId,
          })
        : Promise.resolve(null),
    ]);
    return this.serializeDetail(
      article,
      tags,
      favoritesCount,
      favorite,
      follow,
    );
  }

  private serializeDetail(
    article: Article,
    tags: string[],
    favoritesCount: number,
    favorite: ArticleFavorite | null,
    follow: UserFollow | null,
  ) {
    return serializeArticleDetail({
      ...article,
      author: article.author,
      context: {
        tags,
        favorited: Boolean(favorite),
        favoritesCount,
        authorFollowing: Boolean(follow),
      },
    });
  }

  private async loadOrderedTags(
    articleId: string,
    manager?: EntityManager,
  ): Promise<string[]> {
    const articleTagRepository = manager
      ? manager.getRepository(ArticleTag)
      : this.dataSource.getRepository(ArticleTag);
    const rows = await articleTagRepository
      .createQueryBuilder('articleTag')
      .innerJoin('articleTag.tag', 'tag')
      .select('tag.name', 'name')
      .where('articleTag.articleId = :articleId', { articleId })
      .orderBy('articleTag.position', 'ASC')
      .getRawMany<{ name: string }>();
    return rows.map(({ name }) => name);
  }
}

export class ArticleUpdateUserNotFoundError extends UnauthorizedException {
  constructor() {
    super({ errors: { token: ['is invalid'] } });
  }
}

export class ArticleUpdateArticleNotFoundError extends NotFoundException {
  constructor() {
    super({ errors: { article: ['not found'] } });
  }
}

export class ArticleUpdateForbiddenError extends ForbiddenException {
  constructor() {
    super({ errors: { article: ['forbidden'] } });
  }
}

export class ArticleUpdatePersistenceError extends InternalServerErrorException {
  constructor(cause: unknown) {
    super({ errors: { body: ['request failed'] } }, { cause });
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
      const viewer =
        viewerUsername === undefined
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
      if (
        error instanceof ArticleListQueryValidationError ||
        error instanceof ArticleListViewerNotFoundError ||
        error instanceof ArticleListPersistenceError
      )
        throw error;
      throw new ArticleListPersistenceError(error);
    }
  }
}

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

@Injectable()
export class ArticleFavoriteService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly articleReadService: ArticleReadService,
  ) {}

  async create(slug: string, username: string) {
    return this.dataSource.transaction(async (manager) => {
      const viewer = await manager.getRepository(User).findOne({
        select: { id: true },
        where: { username },
        lock: { mode: 'pessimistic_write' },
      });
      if (!viewer) throw new ArticleFavoriteUserNotFoundError();

      const article = await manager.getRepository(Article).findOne({
        select: { id: true },
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

      return this.articleReadService.getBySlug(slug, username, manager);
    });
  }

  async delete(slug: string, username: string) {
    return this.dataSource.transaction(async (manager) => {
      const viewer = await manager.getRepository(User).findOne({
        select: { id: true },
        where: { username },
        lock: { mode: 'pessimistic_write' },
      });
      if (!viewer) throw new ArticleFavoriteUserNotFoundError();

      const article = await manager.getRepository(Article).findOne({
        select: { id: true },
        where: { slug },
        lock: { mode: 'pessimistic_write' },
      });
      if (!article) throw new ArticleFavoriteArticleNotFoundError();

      await manager.getRepository(ArticleFavorite).delete({
        articleId: article.id,
        userId: viewer.id,
      });

      return this.articleReadService.getBySlug(slug, username, manager);
    });
  }
}
