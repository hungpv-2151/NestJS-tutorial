import {
  Body,
  ConflictException,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';

import { RegisterUserRequestDto } from '../common/dto/user-auth.dto.js';
import {
  serializeUser,
  type SerializedUser,
} from '../users/user.serializer.js';
import type { AuthConfig } from '../config/auth-config.js';
import { createRequestFailureLog } from '../common/logging/request-failure-log.js';
import { AUTH_CONFIG, TOKEN_LIFETIME_SECONDS } from './auth.constants.js';
import { AuthConflictError, AuthService } from './auth.service.js';
import { RegisterUserSwagger } from './auth.swagger.js';
import { createTokenClaims } from './token-claims.js';

export { AUTH_CONFIG } from './auth.constants.js';

@Controller('users')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    @Inject(AUTH_CONFIG) private readonly authConfig: AuthConfig,
  ) {}

  @Post()
  @RegisterUserSwagger()
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  async register(
    @Body() request: RegisterUserRequestDto,
    @Req() httpRequest: Request,
  ): Promise<SerializedUser> {
    const token = await this.createToken(request.user.username, httpRequest);
    let user;
    try {
      user = await this.authService.register(request.user);
    } catch (error) {
      this.logger.error(
        JSON.stringify(createRequestFailureLog(error, httpRequest)),
      );
      if (error instanceof AuthConflictError) {
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

  private async createToken(
    username: string,
    request: Request,
  ): Promise<string> {
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
    } catch (error) {
      this.logger.error(
        JSON.stringify(createRequestFailureLog(error, request)),
      );
      throw new InternalServerErrorException({
        errors: { body: ['request failed'] },
      });
    }
  }
}
