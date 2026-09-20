import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsDefined,
  IsNotEmpty,
  IsString,
  Length,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterUserDto {
  @ApiProperty({ example: 'jane', maxLength: 64, minLength: 1 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  username!: string;

  @ApiProperty({ example: 'jane@example.com', format: 'email', maxLength: 254 })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @Length(1, 254)
  email!: string;

  @ApiProperty({
    example: 'safe-password',
    format: 'password',
    maxLength: 128,
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 128)
  password!: string;
}

export class LoginUserDto {
  @ApiProperty({ example: 'jane@example.com', format: 'email', maxLength: 254 })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @Length(1, 254)
  email!: string;

  @ApiProperty({
    example: 'safe-password',
    format: 'password',
    maxLength: 128,
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 128)
  password!: string;
}

export class RegisterUserRequestDto {
  @ApiProperty({ type: () => RegisterUserDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => RegisterUserDto)
  user!: RegisterUserDto;
}

export class LoginUserRequestDto {
  @ApiProperty({ type: () => LoginUserDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LoginUserDto)
  user!: LoginUserDto;
}

export class UpdateUserDto {
  @ApiProperty({
    example: 'jane@example.com',
    format: 'email',
    maxLength: 254,
    required: false,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @Length(1, 254)
  email?: string;

  @ApiProperty({
    example: 'jane',
    maxLength: 64,
    minLength: 1,
    required: false,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  username?: string;

  @ApiProperty({
    example: 'safe-password',
    format: 'password',
    maxLength: 128,
    minLength: 8,
    required: false,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @Length(8, 128)
  password?: string;

  @ApiProperty({
    example: 'A short biography.',
    nullable: true,
    required: false,
  })
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  bio?: string | null;

  @ApiProperty({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
    required: false,
  })
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  image?: string | null;
}

export class UpdateUserRequestDto {
  @ApiProperty({ type: () => UpdateUserDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => UpdateUserDto)
  user!: UpdateUserDto;
}
