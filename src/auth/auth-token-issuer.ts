import type { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';

import type { AuthConfig } from '../config/auth-config.js';
import { TOKEN_LIFETIME_SECONDS } from './auth.constants.js';
import { createTokenClaims } from './token-claims.js';

export function issueToken(
  jwtService: JwtService,
  config: Pick<AuthConfig, 'audience' | 'issuer'>,
  username: string,
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1_000);
  return jwtService.signAsync(
    createTokenClaims(
      config,
      username,
      randomUUID(),
      issuedAt,
      issuedAt + TOKEN_LIFETIME_SECONDS,
    ),
  );
}
