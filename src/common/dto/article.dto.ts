import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class ArticlePaginationDto {
  @Transform(({ value }) => parseQueryInteger(value, 0))
  @IsInt()
  @Min(0)
  offset = 0;

  @Transform(({ value }) => parseQueryInteger(value, 20))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

function parseQueryInteger(value: unknown, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return Number.NaN;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

export class NewArticleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  description!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  body!: string;

  @ApiPropertyOptional({ items: { type: 'string' }, type: [String] })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  @Matches(/\S/, { each: true })
  tagList?: string[];
}

export class CreateArticleRequestDto {
  @ApiProperty({ type: () => NewArticleDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => NewArticleDto)
  article!: NewArticleDto;
}

export class ArticleUpdateDto {
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  body?: string;

  @ApiPropertyOptional({
    items: { type: 'string', pattern: '\\S' },
    type: [String],
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  @Matches(/\S/, { each: true })
  tagList?: string[];
}

export class ArticleUpdateRequestDto {
  @ApiProperty({ type: () => ArticleUpdateDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ArticleUpdateDto)
  article!: ArticleUpdateDto;
}

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
