import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { User } from '../users/user.entity.js';
import { Article } from '../articles/article.entity.js';
import { Comment } from './comment.entity.js';
import {
  serializeComment,
  type SerializedComment,
} from './comment.serializer.js';

export class CommentCreateUserNotFoundError extends Error {}
export class CommentCreateArticleNotFoundError extends Error {}
export class CommentCreatePersistenceError extends Error {
  constructor(cause: unknown) {
    super('comment could not be created', { cause });
  }
}

@Injectable()
export class CommentCreateService {
  constructor(private readonly dataSource: DataSource) {}

  async create(
    slug: string,
    username: string,
    body: string,
  ): Promise<SerializedComment> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const user = await manager.getRepository(User).findOneBy({ username });
        if (!user) throw new CommentCreateUserNotFoundError();

        const article = await manager.getRepository(Article).findOne({
          where: { slug },
          lock: { mode: 'pessimistic_write' },
        });
        if (!article) throw new CommentCreateArticleNotFoundError();

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
      if (error instanceof CommentCreateUserNotFoundError) {
        throw new CommentCreateUserNotFoundError();
      }
      if (error instanceof CommentCreateArticleNotFoundError) {
        throw new CommentCreateArticleNotFoundError();
      }
      throw new CommentCreatePersistenceError(error);
    }
  }
}
