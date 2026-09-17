import type { AuthConfig } from '../config/auth-config.js';

export interface TokenClaims {
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  sub: string;
}

export function createTokenClaims(
  config: Pick<AuthConfig, 'audience' | 'issuer'>,
  subject: string,
  tokenId: string,
  issuedAt: number,
  expiresAt: number,
): TokenClaims {
  return {
    aud: config.audience,
    exp: expiresAt,
    iat: issuedAt,
    iss: config.issuer,
    jti: tokenId,
    sub: subject,
  };
}
