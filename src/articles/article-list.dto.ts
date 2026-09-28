import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ArticleListQueryDto {
  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  favorited?: string;

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
