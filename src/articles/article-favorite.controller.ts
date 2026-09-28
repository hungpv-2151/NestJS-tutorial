import {
  Controller,
  Delete,
  Header,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
  AuthTokenGuard,
  type AuthenticatedRequest,
} from '../auth/auth-token.guard.js';
import {
  ArticleFavoriteCreateArticleNotFoundError,
  ArticleFavoriteCreateService,
  ArticleFavoriteCreateUserNotFoundError,
} from './article-favorite-create.service.js';
import { CreateArticleFavoriteSwagger } from './article-favorite.swagger.js';
import {
  ArticleFavoriteDeleteArticleNotFoundError,
  ArticleFavoriteDeleteService,
  ArticleFavoriteDeleteUserNotFoundError,
} from './article-favorite-delete.service.js';
import { DeleteArticleFavoriteSwagger } from './article-favorite.swagger.js';

@ApiTags('Favorites')
@Controller('articles')
export class ArticleFavoriteController {
  constructor(
    private readonly articleFavoriteCreateService: ArticleFavoriteCreateService,
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
    try {
      return await this.articleFavoriteCreateService.create(
        slug,
        request.auth.sub,
      );
    } catch (error) {
      if (error instanceof ArticleFavoriteCreateUserNotFoundError) {
        throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
      }
      if (error instanceof ArticleFavoriteCreateArticleNotFoundError) {
        throw new NotFoundException({ errors: { article: ['not found'] } });
      }
      throw new InternalServerErrorException({
        errors: { body: ['request failed'] },
      });
    }
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
    try {
      return await this.articleFavoriteDeleteService.delete(
        slug,
        request.auth.sub,
      );
    } catch (error) {
      if (error instanceof ArticleFavoriteDeleteUserNotFoundError) {
        throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
      }
      if (error instanceof ArticleFavoriteDeleteArticleNotFoundError) {
        throw new NotFoundException({ errors: { article: ['not found'] } });
      }
      throw new InternalServerErrorException({
        errors: { body: ['request failed'] },
      });
    }
  }
}
