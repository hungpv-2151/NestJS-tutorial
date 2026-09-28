import {
  Body,
  ConflictException,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
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
import { CreateArticleRequestDto } from './article-create.dto.js';
import {
  ArticleAuthorNotFoundError,
  ArticleCreatePersistenceError,
  ArticleCreateService,
  ArticleSlugConflictError,
} from './article-create.service.js';
import { CreateArticleSwagger } from './articles.swagger.js';

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articleCreateService: ArticleCreateService) {}

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
