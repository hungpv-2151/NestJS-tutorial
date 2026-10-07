import {
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Param,
  Post,
  Put,
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
import { CreateArticleRequestDto } from '../common/dto/article-create.dto.js';
import {
  ArticleAuthorNotFoundError,
  ArticleCreatePersistenceError,
  ArticleCreateService,
  ArticleSlugConflictError,
} from './article-create.service.js';
import { ArticleReadService } from './article-read.service.js';
import { ArticleUpdateRequestDto } from '../common/dto/article-update.dto.js';
import { ArticleUpdateService } from './article-update.service.js';
import {
  CreateArticleSwagger,
  GetArticleSwagger,
  UpdateArticleSwagger,
} from './articles.swagger.js';

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(
    private readonly articleCreateService: ArticleCreateService,
    private readonly articleReadService: ArticleReadService,
    private readonly articleUpdateService: ArticleUpdateService,
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
    return await this.articleReadService.getBySlug(slug, request.auth?.sub);
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

  @Put(':slug')
  @UseGuards(AuthTokenGuard)
  @UpdateArticleSwagger()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'private, no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async update(
    @Param('slug') slug: string,
    @Body() request: ArticleUpdateRequestDto,
    @Req() auth: AuthenticatedRequest,
  ) {
    return await this.articleUpdateService.update(
      slug,
      auth.auth.sub,
      request.article,
    );
  }
}
