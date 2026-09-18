import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { type TokenClaims } from './token-claims.js';
import { AuthInvalidTokenError, AuthService } from './auth.service.js';

const AUTH_TOKEN_SCHEME = 'Token';

export interface AuthenticatedRequest extends Request {
  auth: TokenClaims & { token: string };
}

@Injectable()
export class AuthTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = getToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException({ errors: { token: ['is missing'] } });
    }

    try {
      request.auth = { ...(await this.authService.authenticate(token)), token };
      return true;
    } catch (error) {
      if (error instanceof AuthInvalidTokenError) {
        throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
      }
      throw error;
    }
  }
}

function getToken(authorization: string | undefined): string | undefined {
  const [scheme, token, extra] = authorization?.trim().split(/\s+/) ?? [];
  return scheme === AUTH_TOKEN_SCHEME && token && !extra ? token : undefined;
}
