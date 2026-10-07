import {
  Body,
  Delete,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Query,
  Put,
  Req,
  UnauthorizedException,
  UnprocessableEntityException,
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
import { CreateArticleRequestDto } from '../common/dto/article.dto.js';
import { ArticleUpdateRequestDto } from '../common/dto/article.dto.js';
import { ArticlePaginationDto } from '../common/dto/article.dto.js';
import { ArticleListQueryDto } from '../common/dto/article.dto.js';
import {
  ArticleAuthorNotFoundError,
  ArticleFavoriteService,
  ArticleListService,
  ArticleListViewerNotFoundError,
  ArticleListPersistenceError,
  ArticleCreatePersistenceError,
  ArticleCreateService,
  ArticleDeleteArticleNotFoundError,
  ArticleDeleteForbiddenError,
  ArticleDeletePersistenceError,
  ArticleDeleteService,
  ArticleDeleteUserNotFoundError,
  ArticleReadService,
  ArticleSlugConflictError,
  ArticleUpdateService,
} from './article.service.js';
import {
  CreateArticleFavoriteSwagger,
  CreateArticleSwagger,
  DeleteArticleFavoriteSwagger,
  DeleteArticleSwagger,
  GetArticleFeedSwagger,
  GetArticleListSwagger,
  GetArticleSwagger,
  UpdateArticleSwagger,
} from './articles.swagger.js';
import { ArticleListQueryValidationError } from './article-list-query.service.js';

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(
    private readonly articleCreateService: ArticleCreateService,
    private readonly articleReadService: ArticleReadService,
    private readonly articleUpdateService: ArticleUpdateService,
    private readonly articleDeleteService: ArticleDeleteService,
    private readonly articleListService: ArticleListService,
    private readonly articleFavoriteService: ArticleFavoriteService,
  ) {}

  @Get()
  @UseGuards(OptionalAuthTokenGuard)
  @GetArticleListSwagger()
  @Header('Cache-Control', 'private, no-store')
  async list(
    @Query() query: ArticleListQueryDto,
    @Req() request: OptionalAuthenticatedRequest,
  ) {
    try {
      return await this.articleListService.list(
        {
          tag: query.tag,
          authorUsername: query.author,
          favoritedUsername: query.favorited,
          offset: query.offset,
          limit: query.limit,
        },
        request.auth?.sub,
      );
    } catch (error) {
      this.handleArticleListError(error);
    }
  }

  @Get('feed')
  @UseGuards(AuthTokenGuard)
  @GetArticleFeedSwagger()
  @Header('Cache-Control', 'private, no-store')
  async feed(
    @Query() query: ArticlePaginationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    try {
      return await this.articleListService.feed(
        { offset: query.offset, limit: query.limit },
        request.auth.sub,
      );
    } catch (error) {
      this.handleArticleListError(error);
    }
  }

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

  @Delete(':slug')
  @UseGuards(AuthTokenGuard)
  @DeleteArticleSwagger()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'private, no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async delete(
    @Param('slug') slug: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    try {
      await this.articleDeleteService.delete(slug, request.auth.sub);
    } catch (error) {
      if (error instanceof ArticleDeleteUserNotFoundError) {
        throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
      }
      if (error instanceof ArticleDeleteArticleNotFoundError) {
        throw new NotFoundException({ errors: { article: ['not found'] } });
      }
      if (error instanceof ArticleDeleteForbiddenError) {
        throw new ForbiddenException({ errors: { article: ['forbidden'] } });
      }
      throw new InternalServerErrorException({
        errors: { body: ['request failed'] },
      });
    }
  }

  @Post(':slug/favorite')
  @UseGuards(AuthTokenGuard)
  @CreateArticleFavoriteSwagger()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'private, no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async createFavorite(
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
  async deleteFavorite(
    @Param('slug') slug: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return await this.articleFavoriteService.delete(slug, request.auth.sub);
  }

  private handleArticleListError(error: unknown): never {
    if (error instanceof ArticleListViewerNotFoundError) {
      throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
    }
    if (error instanceof ArticleListQueryValidationError) {
      throw new UnprocessableEntityException({
        errors: { query: ['is invalid'] },
      });
    }
    if (error instanceof ArticleListPersistenceError) {
      throw new InternalServerErrorException({
        errors: { body: ['request failed'] },
      });
    }
    throw error;
  }
}
