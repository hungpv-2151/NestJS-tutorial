import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

const toNumber = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

export class PaginationQueryDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  @Max(10_000)
  offset = 0;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
