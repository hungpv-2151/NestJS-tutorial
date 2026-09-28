import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsString,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

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
