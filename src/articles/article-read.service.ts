import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

import { User } from '../users/user.entity.js';
import { UserFollow } from '../profiles/user-follow.entity.js';
import { ArticleFavorite } from './article-favorite.entity.js';
import { ArticleTag } from './article-tag.entity.js';
import { Article } from './article.entity.js';
import { serializeArticleDetail } from './article.serializer.js';

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
