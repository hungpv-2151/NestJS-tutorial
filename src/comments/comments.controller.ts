import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { OptionalAuthGuard, RequiredAuthGuard } from '../auth/auth.guards.js';
import { CurrentPrincipal } from '../auth/principal.decorator.js';
import type { Principal } from '../auth/auth.service.js';
import { CreateCommentDto } from './comment.dto.js';
import { CommentsService } from './comments.service.js';

@Controller('articles')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @UseGuards(OptionalAuthGuard)
  @Get(':slug/comments')
  list(@Param('slug') slug: string, @CurrentPrincipal() principal?: Principal) {
    return this.comments.list(slug, principal?.id);
  }

  @UseGuards(RequiredAuthGuard)
  @Post(':slug/comments')
  create(@Param('slug') slug: string, @Body() body: CreateCommentDto, @CurrentPrincipal() principal: Principal) {
    return this.comments.create(slug, principal.id, body.comment);
  }

  @UseGuards(RequiredAuthGuard)
  @Delete(':slug/comments/:id')
  @HttpCode(204)
  async remove(@Param('slug') slug: string, @Param('id', ParseIntPipe) id: number, @CurrentPrincipal() principal: Principal): Promise<void> {
    await this.comments.remove(slug, id, principal.id);
  }
}
