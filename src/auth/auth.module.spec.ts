import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { afterEach, describe, expect, it } from 'vitest';

import { User } from '../users/user.entity.js';
import type { AuthConfig } from '../config/auth-config.js';
import { AUTH_CONFIG } from './auth.constants.js';
import { AuthModule } from './auth.module.js';
import { AuthInvalidTokenError, AuthService } from './auth.service.js';

describe('AuthModule', () => {
  let module: TestingModule | undefined;

  afterEach(async () => {
    await module?.close();
  });

  it('registers User metadata for the registration service', async () => {
    module = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    expect(module.get(DataSource).hasMetadata(User)).toBe(true);
  });

  it('verifies configured JWT claims through AuthService', async () => {
    module = await Test.createTestingModule({ imports: [AuthModule] }).compile();
    const authService = module.get(AuthService);
    const jwtService = module.get(JwtService);
    const config = module.get<AuthConfig>(AUTH_CONFIG);
    const now = Math.floor(Date.now() / 1_000);
    const claims = {
      aud: config.audience,
      exp: now + 900,
      iat: now,
      iss: config.issuer,
      jti: 'token-id',
      sub: 'jane',
    };

    await expect(authService.authenticate(jwtService.sign(claims))).resolves.toMatchObject(
      claims,
    );

    for (const invalidClaims of [
      { ...claims, exp: now - 1 },
      { ...claims, iss: 'wrong-issuer' },
      { ...claims, aud: 'wrong-audience' },
    ]) {
      await expect(
        authService.authenticate(jwtService.sign(invalidClaims)),
      ).rejects.toBeInstanceOf(AuthInvalidTokenError);
    }
  });
});
