import {
  Controller,
  Delete,
  ForbiddenException,
  Header,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
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
  ArticleDeleteArticleNotFoundError,
  ArticleDeleteForbiddenError,
  ArticleDeleteService,
  ArticleDeleteUserNotFoundError,
} from './article-delete.service.js';
import { DeleteArticleSwagger } from './article-delete.swagger.js';

@ApiTags('Articles')
@Controller('articles')
export class ArticleDeleteController {
  constructor(private readonly articleDeleteService: ArticleDeleteService) {}

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
}
