import { describe, expect, it } from 'vitest';
import { createTokenClaims } from './token-claims.js';

describe('createTokenClaims', () => {
  it('includes every required registered and authentication claim', () => {
    expect(
      createTokenClaims(
        { audience: 'realworld-client', issuer: 'nestjs-tutorial', secret: 'secret' },
        'user-id',
        'token-id',
        1_000,
        1_900,
      ),
    ).toEqual({
      aud: 'realworld-client',
      exp: 1_900,
      iat: 1_000,
      iss: 'nestjs-tutorial',
      jti: 'token-id',
      sub: 'user-id',
    });
  });
});
