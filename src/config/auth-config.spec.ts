import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import { createTokenClaims } from '../auth/token-claims.js';
import {
  AuthConfigValidationError,
  getAuthConfig,
  toJwtModuleOptions,
} from './auth-config.js';

describe('getAuthConfig', () => {
  const environment = {
    JWT_AUDIENCE: 'realworld-client',
    JWT_ISSUER: 'nestjs-tutorial',
    JWT_SECRET: 'a-secret-that-is-supplied-by-the-environment',
  };

  it('creates HS256 signing options from required environment values', () => {
    expect(getAuthConfig(environment)).toEqual({
      audience: environment.JWT_AUDIENCE,
      issuer: environment.JWT_ISSUER,
      secret: environment.JWT_SECRET,
    });
  });

  it('only configures the signing algorithm; claims own issuer and audience', () => {
    expect(toJwtModuleOptions(getAuthConfig(environment))).toMatchObject({
      signOptions: { algorithm: 'HS256' },
      verifyOptions: {
        algorithms: ['HS256'],
        audience: environment.JWT_AUDIENCE,
        issuer: environment.JWT_ISSUER,
      },
    });
    expect(toJwtModuleOptions(getAuthConfig(environment)).signOptions).not.toHaveProperty(
      'audience',
    );
    expect(toJwtModuleOptions(getAuthConfig(environment)).signOptions).not.toHaveProperty(
      'issuer',
    );
  });

  it('verifies canonical claims and rejects wrong issuer, audience, and algorithm', () => {
    const config = getAuthConfig(environment);
    const claims = createTokenClaims(
      config,
      'user-id',
      'token-id',
      Math.floor(Date.now() / 1_000),
      Math.floor(Date.now() / 1_000) + 900,
    );
    const jwt = new JwtService(toJwtModuleOptions(config));
    const token = jwt.sign(claims);

    expect(jwt.verify(token)).toMatchObject(claims);

    expect(() => jwt.verify(createToken('wrong-issuer', config, claims))).toThrow();
    expect(() => jwt.verify(createToken('wrong-audience', config, claims))).toThrow();
    expect(() => jwt.verify(createToken('HS384', config, claims))).toThrow();
  });

  it.each(['JWT_SECRET', 'JWT_ISSUER', 'JWT_AUDIENCE'] as const)(
    'requires %s',
    (key) => {
      const invalid = { ...environment };
      delete invalid[key];

      expect(() => getAuthConfig(invalid)).toThrow(AuthConfigValidationError);
      expect(() => getAuthConfig(invalid)).toThrow(`${key} is required`);
    },
  );
});

function createToken(
  invalidClaim: 'wrong-issuer' | 'wrong-audience' | 'HS384',
  config: ReturnType<typeof getAuthConfig>,
  claims: ReturnType<typeof createTokenClaims>,
): string {
  const algorithm = invalidClaim === 'HS384' ? 'HS384' : 'HS256';
  const invalidClaims = {
    ...claims,
    ...(invalidClaim === 'wrong-issuer' ? { iss: 'other-issuer' } : {}),
    ...(invalidClaim === 'wrong-audience' ? { aud: 'other-audience' } : {}),
  };

  return new JwtService({ secret: config.secret }).sign(invalidClaims, {
    algorithm,
  });
}
