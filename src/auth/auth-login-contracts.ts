import type { User } from '../users/user.entity.js';

export interface AuthLoginRateLimiterPort {
  consume(email: string, ipAddress: string | undefined): Promise<void>;
}

export interface AuthLoginTokenIssuer {
  issue(username: string): Promise<string>;
}

export interface AuthLoginRequest {
  email: string;
  ipAddress: string | undefined;
  password: string;
}

export interface AuthenticatedLogin {
  token: string;
  user: User;
}
