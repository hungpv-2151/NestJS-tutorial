import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Article } from '../articles/article.entity.js';
import { UserFollow } from '../profiles/user-follow.entity.js';
import { Comment } from './comment.entity.js';
import {
  serializeComment,
  type SerializedComment,
} from './comment.serializer.js';

export class CommentListArticleNotFoundError extends Error {}

export class CommentListPersistenceError extends Error {
  constructor(cause: unknown) {
    super('comments could not be loaded', { cause });
  }
}

@Injectable()
export class CommentListService {
  constructor(private readonly dataSource: DataSource) {}

  async list(
    slug: string,
    viewerUsername?: string,
  ): Promise<SerializedComment[]> {
    let comments: Comment[];
    try {
      comments = await this.dataSource.transaction(
        'REPEATABLE READ',
        async (manager) => {
          const article = await manager.getRepository(Article).findOne({
            select: { id: true },
            where: { slug },
          });
          if (!article) throw new CommentListArticleNotFoundError();

          return manager
            .getRepository(Comment)
            .createQueryBuilder('comment')
            .innerJoin('comment.author', 'author')
            .addSelect([
              'author.id',
              'author.bio',
              'author.image',
              'author.username',
            ])
            .where('comment.articleId = :articleId', { articleId: article.id })
            .orderBy('comment.createdAt', 'ASC')
            .addOrderBy('comment.id', 'ASC')
            .getMany();
        },
      );
    } catch (error) {
      if (error instanceof CommentListArticleNotFoundError) throw error;
      throw new CommentListPersistenceError(error);
    }

    try {
      if (!viewerUsername || comments.length === 0) {
        return comments.map((comment) => serializeComment(comment));
      }

      const followedAuthorIds = await this.loadFollowedAuthors(viewerUsername, [
        ...new Set(comments.map((comment) => comment.author.id)),
      ]);
      return comments.map((comment) =>
        serializeComment(comment, followedAuthorIds.has(comment.author.id)),
      );
    } catch (error) {
      throw new CommentListPersistenceError(error);
    }
  }

  private async loadFollowedAuthors(
    viewerUsername: string,
    authorIds: string[],
  ): Promise<Set<string>> {
    const rows = await this.dataSource
      .getRepository(UserFollow)
      .createQueryBuilder('userFollow')
      .innerJoin('userFollow.follower', 'follower')
      .select('userFollow.followingId', 'authorId')
      .where('follower.username = :viewerUsername', { viewerUsername })
      .andWhere('userFollow.followingId IN (:...authorIds)', { authorIds })
      .getRawMany<{ authorId: string }>();
    return new Set(rows.map(({ authorId }) => authorId));
  }
}
