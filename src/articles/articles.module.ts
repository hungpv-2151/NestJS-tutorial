import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { OptionalAuthTokenGuard } from '../auth/optional-auth-token.guard.js';
import { UserFollow } from '../profiles/user-follow.entity.js';
import { ArticleFavorite } from './article-favorite.entity.js';
import { ArticleTag } from './article-tag.entity.js';
import { Article } from './article.entity.js';
import { ArticlesController } from './articles.controller.js';
import {
  ArticleCreateService,
  ArticleDeleteService,
  ArticleFavoriteService,
  ArticleListService,
  ArticleReadService,
  ArticleUpdateService,
} from './article.service.js';

import { ArticleListHydrator } from './article-list-hydrator.js';
import { ArticleListQueryService } from './article-list-query.service.js';

import { Tag } from '../tags/tag.entity.js';
import { CommentsModule } from '../comments/comments.module.js';

@Module({
  controllers: [ArticlesController],
  imports: [
    AuthModule,
    CommentsModule,
    TypeOrmModule.forFeature([
      Article,
      ArticleTag,
      ArticleFavorite,
      Tag,
      UserFollow,
    ]),
  ],
  providers: [
    ArticleCreateService,
    ArticleFavoriteService,
    ArticleDeleteService,
    ArticleListHydrator,
    ArticleListService,
    ArticleListQueryService,
    ArticleReadService,
    ArticleUpdateService,
    OptionalAuthTokenGuard,
  ],
})
export class ArticlesModule {}
