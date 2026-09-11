import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { OptionalAuthGuard, RequiredAuthGuard } from '../auth/auth.guards.js';
import { CurrentPrincipal } from '../auth/principal.decorator.js';
import type { Principal } from '../auth/auth.service.js';
import { ArticleQueryDto, CreateArticleDto, UpdateArticleDto } from './article.dto.js';
import { ArticlesService } from './articles.service.js';
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}
  @UseGuards(OptionalAuthGuard) @Get() list(@Query() query: ArticleQueryDto, @CurrentPrincipal() principal?: Principal) { return this.articles.list(query, principal?.id); }
  @UseGuards(RequiredAuthGuard) @Post() create(@Body() body: CreateArticleDto, @CurrentPrincipal() principal: Principal) { return this.articles.create(principal.id, body.article); }
  @UseGuards(OptionalAuthGuard) @Get(':slug') one(@Param('slug') slug: string, @CurrentPrincipal() principal?: Principal) { return this.articles.one(slug, principal?.id); }
  @UseGuards(RequiredAuthGuard) @Put(':slug') update(@Param('slug') slug: string, @Body() body: UpdateArticleDto, @CurrentPrincipal() principal: Principal) { return this.articles.update(slug, principal.id, body.article); }
  @UseGuards(RequiredAuthGuard) @Delete(':slug') @HttpCode(204) async remove(@Param('slug') slug: string, @CurrentPrincipal() principal: Principal): Promise<void> { await this.articles.remove(slug, principal.id); }
}
