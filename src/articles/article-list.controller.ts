import {
  Controller,
  Get,
  Header,
  InternalServerErrorException,
  Query,
  Req,
  UnauthorizedException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
  OptionalAuthTokenGuard,
  type OptionalAuthenticatedRequest,
} from '../auth/optional-auth-token.guard.js';
import { ArticleListQueryDto } from './article-list.dto.js';
import {
  ArticleListPersistenceError,
  ArticleListService,
  ArticleListViewerNotFoundError,
} from './article-list.service.js';
import { ArticleListQueryValidationError } from './article-list-query.service.js';
import { GetArticleListSwagger } from './article-list.swagger.js';

@ApiTags('Articles')
@Controller('articles')
export class ArticleListController {
  constructor(private readonly articleListService: ArticleListService) {}

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
      if (error instanceof ArticleListViewerNotFoundError) {
        throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
      }
      if (error instanceof ArticleListQueryValidationError) {
        throw new UnprocessableEntityException({ errors: { query: ['is invalid'] } });
      }
      if (error instanceof ArticleListPersistenceError) {
        throw new InternalServerErrorException({
          errors: { body: ['request failed'] },
        });
      }
      throw error;
    }
  }
}
