import {
  Controller,
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

@ApiTags('Favorites')
@Controller('articles')
export class ArticleFavoriteController {
  constructor(
    private readonly articleFavoriteCreateService: ArticleFavoriteCreateService,
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
}
