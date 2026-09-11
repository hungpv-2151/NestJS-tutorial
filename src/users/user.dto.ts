import { Transform, Type } from 'class-transformer';
import { IsDefined, IsEmail, IsNotEmpty, IsNotEmptyObject, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
class CredentialsDto {
  @IsString({ message: 'is invalid' }) @IsNotEmpty({ message: "can't be blank" }) @MaxLength(80) username!: string;
  @IsString({ message: 'is invalid' }) @IsNotEmpty({ message: "can't be blank" }) @IsEmail({}, { message: 'is invalid' }) @MaxLength(254) email!: string;
  @IsString({ message: 'is invalid' }) @IsNotEmpty({ message: "can't be blank" }) @MinLength(8, { message: 'is too short' }) @MaxLength(128) password!: string;
}
export class RegisterUserDto { @IsDefined() @ValidateNested() @Type(() => CredentialsDto) user!: CredentialsDto; }
class LoginCredentialsDto { @IsString({ message: 'is invalid' }) @IsNotEmpty({ message: "can't be blank" }) @IsEmail({}, { message: 'is invalid' }) email!: string; @IsString({ message: 'is invalid' }) @IsNotEmpty({ message: "can't be blank" }) @MaxLength(128) password!: string; }
export class LoginUserDto { @IsDefined() @ValidateNested() @Type(() => LoginCredentialsDto) user!: LoginCredentialsDto; }
class UpdateFieldsDto {
  @IsOptional() @IsString({ message: 'is invalid' }) @IsNotEmpty({ message: "can't be blank" }) @MaxLength(80) username?: string;
  @IsOptional() @IsString({ message: 'is invalid' }) @IsNotEmpty({ message: "can't be blank" }) @IsEmail({}, { message: 'is invalid' }) @MaxLength(254) email?: string;
  @IsOptional() @IsString({ message: 'is invalid' }) @IsNotEmpty({ message: "can't be blank" }) @MinLength(8, { message: 'is too short' }) @MaxLength(128) password?: string;
  @IsOptional() @IsString({ message: 'is invalid' }) @MaxLength(500) bio?: string | null;
  @IsOptional() @IsString({ message: 'is invalid' }) @MaxLength(2048) image?: string | null;
}
const rejectEmptyUpdate = ({ value }: { value: unknown }): unknown =>
  value !== null && typeof value === 'object' && Object.keys(value).length === 0 ? undefined : value;
export class UpdateUserDto { @IsDefined() @IsNotEmptyObject() @ValidateNested() @Type(() => UpdateFieldsDto) @Transform(rejectEmptyUpdate) user!: UpdateFieldsDto; }
export type UpdateFields = UpdateFieldsDto;
