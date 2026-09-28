import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { User } from '../users/user.entity.js';
import { UserFollow } from '../profiles/user-follow.entity.js';
import { ArticleFavorite } from './article-favorite.entity.js';
import { ArticleTag } from './article-tag.entity.js';
import { Article } from './article.entity.js';
import { serializeArticleDetail } from './article.serializer.js';

export class ArticleNotFoundError extends Error {}
export class ArticleViewerNotFoundError extends Error {}

@Injectable()
export class ArticleReadService {
  constructor(private readonly dataSource: DataSource) {}

  async getBySlug(slug: string, viewerUsername?: string) {
    const article = await this.dataSource
      .getRepository(Article)
      .createQueryBuilder('article')
      .innerJoinAndSelect('article.author', 'author')
      .where('article.slug = :slug', { slug })
      .getOne();
    if (!article) throw new ArticleNotFoundError();

    const viewer = viewerUsername
      ? await this.dataSource
          .getRepository(User)
          .findOneBy({ username: viewerUsername })
      : null;
    if (viewerUsername && !viewer) throw new ArticleViewerNotFoundError();

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

  private async loadOrderedTags(articleId: string): Promise<string[]> {
    const rows = await this.dataSource
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
