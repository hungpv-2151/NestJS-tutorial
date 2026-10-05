import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { Article } from '../articles/article.entity.js';
import { User } from '../users/user.entity.js';
import { Comment } from './comment.entity.js';
import { CommentService } from './comment.service.js';
import { CommentsController } from './comments.controller.js';

@Module({
  controllers: [CommentsController],
  imports: [AuthModule, TypeOrmModule.forFeature([Article, Comment, User])],
  providers: [CommentService],
})
export class CommentsModule {}
