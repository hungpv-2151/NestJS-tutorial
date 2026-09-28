import { IsOptional, IsString } from 'class-validator';

import { ArticlePaginationDto } from './article-pagination.dto.js';

export class ArticleListQueryDto extends ArticlePaginationDto {
  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  favorited?: string;
}
