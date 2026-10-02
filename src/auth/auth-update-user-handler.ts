import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { UpdateUserDto } from '../common/dto/user-auth.dto.js';
import { createRequestFailureLog } from '../common/logging/request-failure-log.js';
import type { AuthConfig } from '../config/auth-config.js';
import {
  serializeUser,
  type SerializedUser,
} from '../users/user.serializer.js';
import { UserService } from '../users/user.service.js';
import type { AuthenticatedRequest } from './auth-token.guard.js';
import { issueToken } from './auth-token-issuer.js';
import { AUTH_CONFIG } from './auth.constants.js';

@Injectable()
export class AuthUpdateUserHandler {
  private readonly logger = new Logger(AuthUpdateUserHandler.name);

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    @Inject(AUTH_CONFIG) private readonly authConfig: AuthConfig,
  ) {}

  async execute(
    request: AuthenticatedRequest,
    update: UpdateUserDto,
  ): Promise<SerializedUser> {
    try {
      const token = await issueToken(
        this.jwtService,
        this.authConfig,
        request.auth.sub,
      );
      const user = await this.userService.updateCurrentUser(
        request.auth.sub,
        update,
      );
      if (!user) {
        throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
      }
      return serializeUser(user, token);
    } catch (error) {
      this.logger.error(
        JSON.stringify(createRequestFailureLog(error, request)),
      );
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException({
        errors: { body: ['request failed'] },
      });
    }
  }
}
