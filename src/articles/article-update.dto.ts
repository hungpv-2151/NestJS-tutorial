import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsObject,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

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
