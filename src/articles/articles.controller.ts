import {
  Body,
  ConflictException,
  Controller,
  Get,
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
  OptionalAuthTokenGuard,
  type OptionalAuthenticatedRequest,
} from '../auth/optional-auth-token.guard.js';
import { CreateArticleRequestDto } from './article-create.dto.js';
import {
  ArticleAuthorNotFoundError,
  ArticleCreatePersistenceError,
  ArticleCreateService,
  ArticleSlugConflictError,
} from './article-create.service.js';
import { CreateArticleSwagger } from './articles.swagger.js';
import {
  ArticleNotFoundError,
  ArticleReadService,
  ArticleViewerNotFoundError,
} from './article-read.service.js';
import { GetArticleSwagger } from './articles.swagger.js';

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(
    private readonly articleCreateService: ArticleCreateService,
    private readonly articleReadService: ArticleReadService,
  ) {}

  @Get(':slug')
  @UseGuards(OptionalAuthTokenGuard)
  @GetArticleSwagger()
  @Header('Cache-Control', 'private, no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async getBySlug(
    @Param('slug') slug: string,
    @Req() request: OptionalAuthenticatedRequest,
  ) {
    try {
      return await this.articleReadService.getBySlug(slug, request.auth?.sub);
    } catch (error) {
      if (error instanceof ArticleNotFoundError) {
        throw new NotFoundException({ errors: { article: ['not found'] } });
      }
      if (error instanceof ArticleViewerNotFoundError) {
        throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
      }
      throw error;
    }
  }

  @Post()
  @UseGuards(AuthTokenGuard)
  @CreateArticleSwagger()
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async create(
    @Body() request: CreateArticleRequestDto,
    @Req() auth: AuthenticatedRequest,
  ) {
    try {
      return await this.articleCreateService.create(
        auth.auth.sub,
        request.article,
      );
    } catch (error) {
      if (error instanceof ArticleAuthorNotFoundError) {
        throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
      }
      if (error instanceof ArticleSlugConflictError) {
        throw new ConflictException({
          errors: { slug: ['has already been taken'] },
        });
      }
      if (error instanceof ArticleCreatePersistenceError) {
        throw new InternalServerErrorException({
          errors: { body: ['request failed'] },
        });
      }
      throw error;
    }
  }
}
