import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { OptionalAuthTokenGuard } from '../auth/optional-auth-token.guard.js';
import { UserFollow } from '../profiles/user-follow.entity.js';
import { ArticleFavorite } from './article-favorite.entity.js';
import { ArticleTag } from './article-tag.entity.js';
import { Article } from './article.entity.js';
import { ArticlesController } from './articles.controller.js';
import { ArticleDeleteController } from './article-delete.controller.js';
import { ArticleCreateService } from './article-create.service.js';
import { ArticleDeleteService } from './article-delete.service.js';
import { ArticleReadService } from './article-read.service.js';
import { ArticleUpdateService } from './article-update.service.js';
import { Tag } from '../tags/tag.entity.js';

@Module({
  controllers: [ArticlesController, ArticleDeleteController],
  imports: [
    AuthModule,
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
    ArticleDeleteService,
    ArticleReadService,
    ArticleUpdateService,
    OptionalAuthTokenGuard,
  ],
})
export class ArticlesModule {}
