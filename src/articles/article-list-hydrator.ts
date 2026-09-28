import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { UserFollow } from '../profiles/user-follow.entity.js';
import { ArticleFavorite } from './article-favorite.entity.js';
import { ArticleTag } from './article-tag.entity.js';
import type { ArticleListQueryArticle } from './article-list-query.service.js';
import type { ArticleListSerializationInput } from './article.serializer.js';

@Injectable()
export class ArticleListHydrator {
  constructor(private readonly dataSource: DataSource) {}

  async hydrate(
    articles: ArticleListQueryArticle[],
    viewerId?: string,
  ): Promise<ArticleListSerializationInput[]> {
    if (articles.length === 0) return [];

    const articleIds = articles.map(({ id }) => id);
    const authorIds = [...new Set(articles.map(({ author }) => author.id))];
    const [tags, favorites, followingAuthors] = await Promise.all([
      this.loadTags(articleIds),
      this.loadFavorites(articleIds, viewerId),
      viewerId === undefined ? Promise.resolve(new Set<string>()) :
        this.loadFollowingAuthors(viewerId, authorIds),
    ]);

    return articles.map((article) => ({
      slug: article.slug,
      title: article.title,
      description: article.description,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      author: article.author,
      context: {
        tags: tags.get(article.id) ?? [],
        favorited: favorites.get(article.id)?.favorited ?? false,
        favoritesCount: favorites.get(article.id)?.favoritesCount ?? 0,
        authorFollowing: followingAuthors.has(article.author.id),
      },
    }));
  }

  private async loadTags(articleIds: string[]): Promise<Map<string, string[]>> {
    const rows = await this.dataSource
      .getRepository(ArticleTag)
      .createQueryBuilder('articleTag')
      .innerJoin('articleTag.tag', 'tag')
      .select('articleTag.articleId', 'articleId')
      .addSelect('tag.name', 'name')
      .where('articleTag.articleId IN (:...articleIds)', { articleIds })
      .orderBy('articleTag.articleId', 'ASC')
      .addOrderBy('articleTag.position', 'ASC')
      .getRawMany<{ articleId: string; name: string }>();
    const tags = new Map<string, string[]>();
    for (const { articleId, name } of rows) {
      const list = tags.get(articleId) ?? [];
      list.push(name);
      tags.set(articleId, list);
    }
    return tags;
  }

  private async loadFavorites(
    articleIds: string[],
    viewerId?: string,
  ): Promise<Map<string, { favoritesCount: number; favorited: boolean }>> {
    const query = this.dataSource
      .getRepository(ArticleFavorite)
      .createQueryBuilder('favorite')
      .select('favorite.articleId', 'articleId')
      .addSelect('COUNT(*)', 'favoritesCount')
      .addSelect(
        viewerId === undefined
          ? 'FALSE'
          : 'COUNT(*) FILTER (WHERE favorite.userId = :viewerId) > 0',
        'favorited',
      )
      .where('favorite.articleId IN (:...articleIds)', { articleIds })
      .groupBy('favorite.articleId');
    if (viewerId !== undefined) query.setParameter('viewerId', viewerId);

    const rows = await query.getRawMany<{
      articleId: string;
      favoritesCount: string | number;
      favorited: boolean;
    }>();
    return new Map(rows.map((row) => [
      row.articleId,
      { favoritesCount: parseFavoritesCount(row.favoritesCount), favorited: row.favorited },
    ]));
  }

  private async loadFollowingAuthors(
    viewerId: string,
    authorIds: string[],
  ): Promise<Set<string>> {
    const rows = await this.dataSource
      .getRepository(UserFollow)
      .createQueryBuilder('userFollow')
      .select('userFollow.followingId', 'followingId')
      .where('userFollow.followerId = :viewerId', { viewerId })
      .andWhere('userFollow.followingId IN (:...authorIds)', { authorIds })
      .getRawMany<{ followingId: string }>();
    return new Set(rows.map(({ followingId }) => followingId));
  }
}

function parseFavoritesCount(value: string | number): number {
  const count = typeof value === 'number' ? value : /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('Invalid article favorite count');
  }
  return count;
}
