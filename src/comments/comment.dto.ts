import { Type } from 'class-transformer';
import { IsDefined, IsNotEmpty, IsString, MaxLength, ValidateNested } from 'class-validator';

class CommentFields {
  @IsString()
  @IsNotEmpty({ message: "body can't be blank" })
  @MaxLength(10_000)
  body!: string;
}

export class CreateCommentDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => CommentFields)
  comment!: CommentFields;
}

export type CommentInput = CommentFields;
