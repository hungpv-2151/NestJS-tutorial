import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Article } from '../articles/article.entity.js';
import { User } from '../users/user.entity.js';
import { Comment } from './comment.entity.js';

const MAX_COMMENT_ID = 2_147_483_647;

export class CommentDeleteUserNotFoundError extends Error {}
export class CommentDeleteArticleNotFoundError extends Error {}
export class CommentDeleteNotFoundError extends Error {}
export class CommentDeleteForbiddenError extends Error {}
export class CommentDeletePersistenceError extends Error {
  constructor(cause: unknown) {
    super('comment could not be deleted', { cause });
  }
}

@Injectable()
export class CommentDeleteService {
  constructor(private readonly dataSource: DataSource) {}

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
        if (!article) throw new CommentDeleteArticleNotFoundError();

        const user = await manager.getRepository(User).findOneBy({ username });
        if (!user) throw new CommentDeleteUserNotFoundError();
        if (
          !Number.isSafeInteger(commentId) ||
          commentId < 1 ||
          commentId > MAX_COMMENT_ID
        ) {
          throw new CommentDeleteNotFoundError();
        }

        const commentRepository = manager.getRepository(Comment);
        const comment = await commentRepository.findOne({
          where: { articleId: article.id, id: commentId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!comment) throw new CommentDeleteNotFoundError();
        if (comment.authorId !== user.id)
          throw new CommentDeleteForbiddenError();

        const result = await commentRepository.delete({
          articleId: article.id,
          authorId: user.id,
          id: commentId,
        });
        if (result.affected !== 1) {
          throw new CommentDeletePersistenceError(
            new Error('locked comment delete affected an unexpected row count'),
          );
        }
      });
    } catch (error) {
      if (isExpectedDeleteError(error)) throw error;
      throw new CommentDeletePersistenceError(error);
    }
  }
}

function isExpectedDeleteError(error: unknown): boolean {
  return (
    error instanceof CommentDeleteUserNotFoundError ||
    error instanceof CommentDeleteArticleNotFoundError ||
    error instanceof CommentDeleteNotFoundError ||
    error instanceof CommentDeleteForbiddenError ||
    error instanceof CommentDeletePersistenceError
  );
}
