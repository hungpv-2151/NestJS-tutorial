import { Type } from 'class-transformer';
import {
  IsEmail,
  IsDefined,
  IsNotEmpty,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @Length(1, 254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 128)
  password!: string;
}

export class LoginUserDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @Length(1, 254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 128)
  password!: string;
}

export class RegisterUserRequestDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => RegisterUserDto)
  user!: RegisterUserDto;
}

export class LoginUserRequestDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => LoginUserDto)
  user!: LoginUserDto;
}
