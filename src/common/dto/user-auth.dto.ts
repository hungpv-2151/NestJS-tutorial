import { Type } from 'class-transformer';
import {
  IsEmail,
  IsDefined,
  IsNotEmpty,
  IsString,
  Length,
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
