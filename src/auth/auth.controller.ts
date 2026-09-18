import {
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import {
  LoginUserRequestDto,
  RegisterUserRequestDto,
} from '../common/dto/user-auth.dto.js';
import {
  serializeUser,
  type SerializedUser,
} from '../users/user.serializer.js';
import type { AuthConfig } from '../config/auth-config.js';
import { createRequestFailureLog } from '../common/logging/request-failure-log.js';
import { AUTH_CONFIG } from './auth.constants.js';
import { AuthLoginRateLimitError } from './auth-login-rate-limiter.js';
import {
  AuthConflictError,
  AuthInvalidCredentialsError,
  AuthInvalidTokenError,
  AuthService,
} from './auth.service.js';
import { AuthTokenGuard, type AuthenticatedRequest } from './auth-token.guard.js';
import { CurrentUserSwagger, LoginUserSwagger, RegisterUserSwagger } from './auth.swagger.js';
import { issueToken } from './auth-token-issuer.js';

export { AUTH_CONFIG } from './auth.constants.js';

@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    @Inject(AUTH_CONFIG) private readonly authConfig: AuthConfig,
  ) {}

  @Post('users')
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

  @Post('users/login')
  @LoginUserSwagger()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() request: LoginUserRequestDto,
    @Req() httpRequest: Request,
  ): Promise<SerializedUser> {
    try {
      const { token, user } = await this.authService.login({
        email: request.user.email,
        ipAddress: httpRequest.ip,
        password: request.user.password,
      });
      return serializeUser(user, token);
    } catch (error) {
      this.logger.error(
        JSON.stringify(createRequestFailureLog(error, httpRequest)),
      );
      if (error instanceof AuthInvalidCredentialsError) {
        throw new UnauthorizedException({
          errors: { credentials: ['invalid'] },
        });
      }
      if (error instanceof AuthLoginRateLimitError) {
        throw new HttpException(
          { errors: { body: ['too many requests'] } },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new InternalServerErrorException({
        errors: { body: ['request failed'] },
      });
    }
  }

  @Get('user')
  @CurrentUserSwagger()
  @UseGuards(AuthTokenGuard)
  @Header('Cache-Control', 'no-store')
  async currentUser(@Req() request: AuthenticatedRequest): Promise<SerializedUser> {
    try {
      const user = await this.authService.currentUser(request.auth.sub);
      return serializeUser(user, request.auth.token);
    } catch (error) {
      if (error instanceof AuthInvalidTokenError) {
        throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
      }
      throw error;
    }
  }

  private async createToken(
    username: string,
    request: Request,
  ): Promise<string> {
    try {
      return await issueToken(this.jwtService, this.authConfig, username);
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
