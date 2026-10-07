import {
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Article } from '../articles/article.entity.js';
import { UserFollow } from '../profiles/user-follow.entity.js';
import { User } from '../users/user.entity.js';
import { Comment } from './comment.entity.js';
import {
  serializeComment,
  type SerializedComment,
} from '../common/serializers/comment.serializer.js';

export class CommentUserNotFoundError extends UnauthorizedException {
  constructor() {
    super({ errors: { token: ['is invalid'] } });
  }
}

export class CommentArticleNotFoundError extends NotFoundException {
  constructor() {
    super({ errors: { article: ['not found'] } });
  }
}

export class CommentPersistenceError extends InternalServerErrorException {
  constructor(cause: unknown) {
    super({ errors: { body: ['request failed'] } }, { cause });
  }
}

@Injectable()
export class CommentService {
  constructor(private readonly dataSource: DataSource) {}

  async create(
    slug: string,
    username: string,
    body: string,
  ): Promise<SerializedComment> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const user = await manager.getRepository(User).findOneBy({ username });
        if (!user) throw new CommentUserNotFoundError();

        const article = await manager.getRepository(Article).findOne({
          where: { slug },
          lock: { mode: 'pessimistic_write' },
        });
        if (!article) throw new CommentArticleNotFoundError();

        const commentRepository = manager.getRepository(Comment);
        const comment = await commentRepository.save(
          commentRepository.create({
            articleId: article.id,
            authorId: user.id,
            body: body.trim(),
          }),
        );
        return serializeComment({ ...comment, author: user });
      });
    } catch (error) {
      rethrowCommentError(error);
    }
  }

  async list(
    slug: string,
    viewerUsername?: string,
  ): Promise<SerializedComment[]> {
    try {
      const comments = await this.dataSource.transaction(
        'REPEATABLE READ',
        async (manager) => {
          const article = await manager.getRepository(Article).findOne({
            select: { id: true },
            where: { slug },
          });
          if (!article) throw new CommentArticleNotFoundError();

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
      rethrowCommentError(error);
    }
  }

  async delete(
    slug: string,
    commentId: number,
    username: string,
  ): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const article = await manager.getRepository(Article).findOne({
          where: { slug },
          lock: { mode: 'pessimistic_write' },
        });
        if (!article) throw new CommentArticleNotFoundError();

        const user = await manager.getRepository(User).findOneBy({ username });
        if (!user) throw new CommentUserNotFoundError();

        if (
          !Number.isSafeInteger(commentId) ||
          commentId < 1 ||
          commentId > 2_147_483_647
        ) {
          throw new NotFoundException({ errors: { comment: ['not found'] } });
        }

        const repository = manager.getRepository(Comment);
        const comment = await repository.findOne({
          where: { articleId: article.id, id: commentId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!comment) {
          throw new NotFoundException({ errors: { comment: ['not found'] } });
        }
        if (comment.authorId !== user.id) {
          throw new ForbiddenException({ errors: { comment: ['forbidden'] } });
        }

        const result = await repository.delete({
          articleId: article.id,
          authorId: user.id,
          id: commentId,
        });
        if (result.affected !== 1) {
          throw new CommentPersistenceError(
            new Error('locked comment delete affected an unexpected row count'),
          );
        }
      });
    } catch (error) {
      rethrowCommentError(error);
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

function rethrowCommentError(error: unknown): never {
  if (
    error instanceof HttpException ||
    error instanceof CommentPersistenceError
  ) {
    throw error;
  }

  throw new CommentPersistenceError(error);
}
