import { Injectable } from '@nestjs/common';
import { DataSource, type SelectQueryBuilder } from 'typeorm';

import { User } from '../users/user.entity.js';
import { ArticleFavorite } from './article-favorite.entity.js';
import { ArticleTag } from './article-tag.entity.js';
import { Article } from './article.entity.js';
import { Tag } from '../tags/tag.entity.js';

export interface ArticleListQueryCriteria {
  tag?: string;
  authorUsername?: string;
  favoritedUsername?: string;
  offset: number;
  limit: number;
}

export interface ArticleListQueryResult {
  articles: ArticleListQueryArticle[];
  articlesCount: number;
}

export interface ArticleListQueryArticle {
  id: string;
  authorId: string;
  slug: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  author: Pick<User, 'id' | 'username' | 'bio' | 'image'>;
}

export class ArticleListQueryValidationError extends Error {
  constructor() {
    super('Invalid article list query criteria');
    this.name = ArticleListQueryValidationError.name;
  }
}

export class ArticleListQueryPersistenceError extends Error {
  constructor() {
    super('Could not load articles');
    this.name = ArticleListQueryPersistenceError.name;
  }
}

@Injectable()
export class ArticleListQueryService {
  constructor(private readonly dataSource: DataSource) {}

  async list(
    criteria: ArticleListQueryCriteria,
  ): Promise<ArticleListQueryResult> {
    validateCriteria(criteria);

    try {
      const query = this.dataSource
        .getRepository(Article)
        .createQueryBuilder('article')
        .innerJoinAndSelect('article.author', 'author')
        .select([
          'article.id',
          'article.authorId',
          'article.slug',
          'article.title',
          'article.description',
          'article.createdAt',
          'article.updatedAt',
          'author.id',
          'author.username',
          'author.bio',
          'author.image',
        ]);
      addFilters(query, criteria);

      const countRow = await query
        .clone()
        .select('COUNT(DISTINCT article.id)', 'articlesCount')
        .orderBy()
        .getRawOne<{ articlesCount: string | number }>();
      const articlesCount = Number(countRow?.articlesCount);
      if (!Number.isSafeInteger(articlesCount) || articlesCount < 0) {
        throw new ArticleListQueryPersistenceError();
      }

      const articles: ArticleListQueryArticle[] = await query
        .clone()
        .orderBy('article.createdAt', 'DESC')
        .addOrderBy('article.id', 'DESC')
        .skip(criteria.offset)
        .take(criteria.limit)
        .getMany();

      return { articles, articlesCount };
    } catch {
      throw new ArticleListQueryPersistenceError();
    }
  }
}

function addFilters(
  query: SelectQueryBuilder<Article>,
  criteria: ArticleListQueryCriteria,
): void {
  if (criteria.authorUsername !== undefined) {
    query.andWhere('author.username = :authorUsername', {
      authorUsername: criteria.authorUsername,
    });
  }

  if (criteria.tag !== undefined) {
    const matchingTag = query
      .subQuery()
      .select('1')
      .from(ArticleTag, 'articleTag')
      .innerJoin(Tag, 'tag', 'tag.id = articleTag.tagId')
      .where('articleTag.articleId = article.id')
      .andWhere('tag.name = :tag')
      .getQuery();
    query.andWhere(`EXISTS ${matchingTag}`, { tag: criteria.tag });
  }

  if (criteria.favoritedUsername !== undefined) {
    const matchingFavorite = query
      .subQuery()
      .select('1')
      .from(ArticleFavorite, 'favorite')
      .innerJoin(User, 'favoritedUser', 'favoritedUser.id = favorite.userId')
      .where('favorite.articleId = article.id')
      .andWhere('favoritedUser.username = :favoritedUsername')
      .getQuery();
    query.andWhere(`EXISTS ${matchingFavorite}`, {
      favoritedUsername: criteria.favoritedUsername,
    });
  }
}

function validateCriteria(criteria: ArticleListQueryCriteria): void {
  if (typeof criteria !== 'object' || criteria === null) {
    throw new ArticleListQueryValidationError();
  }

  if (
    !Number.isSafeInteger(criteria.offset) ||
    criteria.offset < 0 ||
    !Number.isSafeInteger(criteria.limit) ||
    criteria.limit < 1 ||
    criteria.limit > 100 ||
    !isOptionalString(criteria.tag) ||
    !isOptionalString(criteria.authorUsername) ||
    !isOptionalString(criteria.favoritedUsername)
  ) {
    throw new ArticleListQueryValidationError();
  }
}

function isOptionalString(value: string | undefined): boolean {
  return value === undefined || typeof value === 'string';
}
