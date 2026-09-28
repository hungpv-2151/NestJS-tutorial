import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { ArticleFavorite } from './article-favorite.entity.js';
import { ArticleTag } from './article-tag.entity.js';
import { Article } from './article.entity.js';
import { ArticlesController } from './articles.controller.js';
import { ArticleCreateService } from './article-create.service.js';
import { Tag } from '../tags/tag.entity.js';

@Module({
  controllers: [ArticlesController],
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Article, ArticleTag, ArticleFavorite, Tag]),
  ],
  providers: [ArticleCreateService],
})
export class ArticlesModule {}
