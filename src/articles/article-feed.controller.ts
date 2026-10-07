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
  AuthTokenGuard,
  type AuthenticatedRequest,
} from '../auth/auth-token.guard.js';
import { ArticlePaginationDto } from '../common/dto/article-pagination.dto.js';
import {
  ArticleListPersistenceError,
  ArticleListService,
  ArticleListViewerNotFoundError,
} from './article-list.service.js';
import { ArticleListQueryValidationError } from './article-list-query.service.js';
import { GetArticleFeedSwagger } from './article-feed.swagger.js';

@ApiTags('Articles')
@Controller('articles')
export class ArticleFeedController {
  constructor(private readonly articleListService: ArticleListService) {}

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
