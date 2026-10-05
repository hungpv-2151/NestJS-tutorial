import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Article } from '../articles/article.entity.js';
import { User } from '../users/user.entity.js';
import { Comment } from './comment.entity.js';
import {
  serializeComment,
  type SerializedComment,
} from './comment.serializer.js';

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
      if (isExpectedCommentError(error)) throw error;
      throw new CommentPersistenceError(error);
    }
  }
}

function isExpectedCommentError(error: unknown): boolean {
  return (
    error instanceof CommentUserNotFoundError ||
    error instanceof CommentArticleNotFoundError
  );
}
