import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthTokenGuard } from './auth-token.guard.js';
import type { TokenClaims } from './token-claims.js';

export interface OptionalAuthenticatedRequest extends Request {
  auth?: TokenClaims & { token: string };
}

@Injectable()
export class OptionalAuthTokenGuard implements CanActivate {
  constructor(private readonly authTokenGuard: AuthTokenGuard) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<OptionalAuthenticatedRequest>();
    if (request.headers.authorization === undefined) return true;
    return this.authTokenGuard.canActivate(context).catch((error: unknown) => {
      if (isMissingTokenError(error)) {
        throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
      }
      throw error;
    });
  }
}

function isMissingTokenError(error: unknown): boolean {
  if (!(error instanceof UnauthorizedException)) return false;
  const response = error.getResponse();
  if (
    typeof response !== 'object' ||
    response === null ||
    !('errors' in response)
  ) {
    return false;
  }
  const errors = response.errors;
  return (
    typeof errors === 'object' &&
    errors !== null &&
    'token' in errors &&
    Array.isArray(errors.token) &&
    errors.token[0] === 'is missing'
  );
}
