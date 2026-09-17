import {
  Body,
  ConflictException,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';

import { RegisterUserRequestDto } from '../common/dto/user-auth.dto.js';
import { serializeUser, type SerializedUser } from '../users/user.serializer.js';
import {
  UserRegistrationConflictError,
  UserRegistrationService,
} from '../users/user-registration.service.js';
import type { AuthConfig } from '../config/auth-config.js';
import { createTokenClaims } from './token-claims.js';

const TOKEN_LIFETIME_SECONDS = 15 * 60;
export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

@Controller('users')
export class RegisterUserController {
  constructor(
    private readonly registrationService: UserRegistrationService,
    private readonly jwtService: JwtService,
    @Inject(AUTH_CONFIG) private readonly authConfig: AuthConfig,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  async register(
    @Body() request: RegisterUserRequestDto,
  ): Promise<SerializedUser> {
    const token = await this.createToken(request.user.username);
    let user;
    try {
      user = await this.registrationService.register(request.user);
    } catch (error) {
      if (error instanceof UserRegistrationConflictError) {
        throw new ConflictException({
          errors: { [error.field]: ['has already been taken'] },
        });
      }
      throw new InternalServerErrorException({
        errors: { body: ['request failed'] },
      });
    }

    return serializeUser({ ...user, bio: null, image: null }, token);
  }

  private async createToken(username: string): Promise<string> {
    const issuedAt = Math.floor(Date.now() / 1_000);
    try {
      return await this.jwtService.signAsync(
        createTokenClaims(
          this.authConfig,
          username,
          randomUUID(),
          issuedAt,
          issuedAt + TOKEN_LIFETIME_SECONDS,
        ),
      );
    } catch {
      throw new InternalServerErrorException({
        errors: { body: ['request failed'] },
      });
    }
  }
}
