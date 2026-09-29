import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { OptionalAuthTokenGuard } from '../auth/optional-auth-token.guard.js';
import { Article } from '../articles/article.entity.js';
import { UserFollow } from '../profiles/user-follow.entity.js';
import { User } from '../users/user.entity.js';
import { Comment } from './comment.entity.js';
import { CommentService } from './comment.service.js';
import { CommentsController } from './comments.controller.js';

@Module({
  controllers: [CommentsController],
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Article, Comment, User, UserFollow]),
  ],
  providers: [CommentService, OptionalAuthTokenGuard],
})
export class CommentsModule {}
