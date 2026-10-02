import { Injectable, UnauthorizedException } from '@nestjs/common';

import {
  serializeUser,
  type SerializedUser,
} from '../users/user.serializer.js';
import type { AuthenticatedRequest } from './auth-token.guard.js';
import { AuthInvalidTokenError, AuthService } from './auth.service.js';

@Injectable()
export class AuthCurrentUserHandler {
  constructor(private readonly authService: AuthService) {}

  async execute(request: AuthenticatedRequest): Promise<SerializedUser> {
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
}
