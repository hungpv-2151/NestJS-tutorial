import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsObject,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const COMMENT_BODY_MAX_LENGTH = 10_000;

export class NewCommentDto {
  @ApiProperty({ maxLength: COMMENT_BODY_MAX_LENGTH, type: String })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(COMMENT_BODY_MAX_LENGTH)
  body!: string;
}

export class CreateCommentRequestDto {
  @ApiProperty({ type: () => NewCommentDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => NewCommentDto)
  comment!: NewCommentDto;
}
