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

export function isTokenClaims(value: unknown): value is TokenClaims {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isNonEmptyString(value.aud) &&
    isNonEmptyString(value.iss) &&
    isNonEmptyString(value.sub) &&
    isNonEmptyString(value.jti) &&
    typeof value.exp === 'number' &&
    Number.isFinite(value.exp) &&
    typeof value.iat === 'number' &&
    Number.isFinite(value.iat)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
