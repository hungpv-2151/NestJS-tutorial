import {
  Controller,
  Delete,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
  AuthTokenGuard,
  type AuthenticatedRequest,
} from '../auth/auth-token.guard.js';
import { ArticleFavoriteService } from './article-favorite.service.js';
import { CreateArticleFavoriteSwagger } from './article-favorite.swagger.js';
import { ArticleFavoriteDeleteService } from './article-favorite-delete.service.js';
import { DeleteArticleFavoriteSwagger } from './article-favorite.swagger.js';

@ApiTags('Favorites')
  @Controller('articles')
export class ArticleFavoriteController {
  constructor(
    private readonly articleFavoriteService: ArticleFavoriteService,
    private readonly articleFavoriteDeleteService: ArticleFavoriteDeleteService,
  ) {}

  @Post(':slug/favorite')
  @UseGuards(AuthTokenGuard)
  @CreateArticleFavoriteSwagger()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'private, no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async create(
    @Param('slug') slug: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return await this.articleFavoriteService.create(slug, request.auth.sub);
  }

  @Delete(':slug/favorite')
  @UseGuards(AuthTokenGuard)
  @DeleteArticleFavoriteSwagger()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'private, no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async delete(
    @Param('slug') slug: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return await this.articleFavoriteDeleteService.delete(
      slug,
      request.auth.sub,
    );
  }
}
