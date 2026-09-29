import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
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
import { CommentService } from './comment.service.js';
import {
  CreateArticleCommentSwagger,
  GetArticleCommentsSwagger,
} from './comments.swagger.js';

@ApiTags('Comments')
@Controller('articles')
export class CommentsController {
  constructor(private readonly commentService: CommentService) {}

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
    return {
      comments: await this.commentService.list(slug, auth.auth?.sub),
    };
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
    return {
      comment: await this.commentService.create(
        slug,
        auth.auth.sub,
        request.comment.body,
      ),
    };
  }
}
