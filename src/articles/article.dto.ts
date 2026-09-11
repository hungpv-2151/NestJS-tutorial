import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDefined, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
class ArticleFields {
  @IsString() @IsNotEmpty({ message: "title can't be blank" }) @MaxLength(200) title!: string;
  @IsString() @IsNotEmpty({ message: "description can't be blank" }) @MaxLength(500) description!: string;
  @IsString() @IsNotEmpty({ message: "body can't be blank" }) @MaxLength(50_000) body!: string;
  @ValidateIf((_object, value) => value !== undefined) @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(50, { each: true }) tagList?: string[];
}
class UpdateFields { @IsOptional() @IsString() @IsNotEmpty({ message: "title can't be blank" }) @MaxLength(200) title?: string; @IsOptional() @IsString() @IsNotEmpty({ message: "description can't be blank" }) @MaxLength(500) description?: string; @IsOptional() @IsString() @IsNotEmpty({ message: "body can't be blank" }) @MaxLength(50_000) body?: string; @ValidateIf((_object, value) => value !== undefined) @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(50, { each: true }) tagList?: string[]; }
export class CreateArticleDto { @IsDefined() @ValidateNested() @Type(() => ArticleFields) article!: ArticleFields; }
export class UpdateArticleDto { @IsDefined() @ValidateNested() @Type(() => UpdateFields) article!: UpdateFields; }
const number = ({ value }: { value: unknown }) => typeof value === 'string' ? Number(value) : value;
export class ArticleQueryDto { @IsOptional() @IsString() tag?: string; @IsOptional() @IsString() author?: string; @IsOptional() @IsString() favorited?: string; @IsOptional() @Transform(number) @IsInt() @Min(0) @Max(10_000) offset = 0; @IsOptional() @Transform(number) @IsInt() @Min(1) @Max(100) limit = 20; }
export type ArticleInput = ArticleFields;
export type ArticleUpdate = UpdateFields;
