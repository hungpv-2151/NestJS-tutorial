import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  ParseIntPipe,
  Param,
  Post,
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
import { CreateCommentRequestDto } from './comment-create.dto.js';
import {
  CommentCreateArticleNotFoundError,
  CommentCreateService,
  CommentCreateUserNotFoundError,
} from './comment-create.service.js';
import {
  CommentListArticleNotFoundError,
  CommentListPersistenceError,
  CommentListService,
} from './comment-list.service.js';
import {
  CommentDeleteArticleNotFoundError,
  CommentDeleteForbiddenError,
  CommentDeleteNotFoundError,
  CommentDeleteService,
  CommentDeleteUserNotFoundError,
} from './comment-delete.service.js';
import { DeleteArticleCommentSwagger } from './comments-delete.swagger.js';
import {
  CreateArticleCommentSwagger,
  GetArticleCommentsSwagger,
} from './comments.swagger.js';

@ApiTags('Comments')
@Controller('articles')
export class CommentsController {
  constructor(
    private readonly commentCreateService: CommentCreateService,
    private readonly commentListService: CommentListService,
    private readonly commentDeleteService: CommentDeleteService,
  ) {}

  @Get(':slug/comments')
  @UseGuards(OptionalAuthTokenGuard)
  @GetArticleCommentsSwagger()
  @Header('Cache-Control', 'private, no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async list(
    @Param('slug') slug: string,
    @Req() auth: OptionalAuthenticatedRequest,
  ) {
    try {
      return {
        comments: await this.commentListService.list(slug, auth.auth?.sub),
      };
    } catch (error) {
      if (error instanceof CommentListArticleNotFoundError) {
        throw new NotFoundException({ errors: { article: ['not found'] } });
      }
      if (error instanceof CommentListPersistenceError) {
        throw new InternalServerErrorException(
          { errors: { body: ['request failed'] } },
          { cause: error },
        );
      }
      throw new InternalServerErrorException(
        { errors: { body: ['request failed'] } },
        { cause: error },
      );
    }
  }

  @Post(':slug/comments')
  @UseGuards(AuthTokenGuard)
  @CreateArticleCommentSwagger()
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'private, no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async create(
    @Param('slug') slug: string,
    @Body() request: CreateCommentRequestDto,
    @Req() auth: AuthenticatedRequest,
  ) {
    try {
      return {
        comment: await this.commentCreateService.create(
          slug,
          auth.auth.sub,
          request.comment.body,
        ),
      };
    } catch (error) {
      if (error instanceof CommentCreateUserNotFoundError) {
        throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
      }
      if (error instanceof CommentCreateArticleNotFoundError) {
        throw new NotFoundException({ errors: { article: ['not found'] } });
      }
      throw new InternalServerErrorException(
        { errors: { body: ['request failed'] } },
        { cause: error },
      );
    }
  }

  @Delete(':slug/comments/:id')
  @UseGuards(AuthTokenGuard)
  @DeleteArticleCommentSwagger()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'private, no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async delete(
    @Param('slug') slug: string,
    @Param(
      'id',
      new ParseIntPipe({
        exceptionFactory: () =>
          new UnprocessableEntityException({
            errors: { id: ['must be an integer'] },
          }),
      }),
    )
    id: number,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    try {
      await this.commentDeleteService.delete(slug, id, request.auth.sub);
    } catch (error) {
      if (error instanceof CommentDeleteUserNotFoundError) {
        throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
      }
      if (error instanceof CommentDeleteArticleNotFoundError) {
        throw new NotFoundException({ errors: { article: ['not found'] } });
      }
      if (error instanceof CommentDeleteNotFoundError) {
        throw new NotFoundException({ errors: { comment: ['not found'] } });
      }
      if (error instanceof CommentDeleteForbiddenError) {
        throw new ForbiddenException({ errors: { comment: ['forbidden'] } });
      }
      throw new InternalServerErrorException(
        { errors: { body: ['request failed'] } },
        { cause: error },
      );
    }
  }
}
