import { INestApplication, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthController, AUTH_CONFIG } from '../src/auth/auth.controller.js';
import { AUTH_LOGIN_RATE_LIMITER } from '../src/auth/auth.constants.js';
import { AuthLoginRateLimiter } from '../src/auth/auth-login-rate-limiter.js';
import { AuthTokenGuard } from '../src/auth/auth-token.guard.js';
import {
  AuthInvalidTokenError,
  AuthService,
} from '../src/auth/auth.service.js';
import { configureGlobalRequestHandling } from '../src/create-app.js';
import {
  TokenDenyListService,
  type TokenDenyListClient,
} from '../src/auth/token-deny-list.service.js';
import { UserService } from '../src/users/user.service.js';

describe('POST /api/user/logout (e2e)', () => {
  let app: INestApplication<App>;

  afterEach(async () => {
    await app?.close();
  });

  it('logs out the token and rejects its reuse', async () => {
    const redis = new InMemoryDenyListClient();
    app = await createApp(redis);
    const server = request(app.getHttpServer());

    await server
      .post('/api/user/logout')
      .set('Authorization', 'Token signed-token')
      .expect(204);

    await server
      .get('/api/user')
      .set('Authorization', 'Token signed-token')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });

    expect(redis.set).toHaveBeenCalledWith(
      'auth:deny-list:token-id',
      '1',
      'EX',
      901,
    );
  });

  it('rejects logout without a token', async () => {
    app = await createApp(new InMemoryDenyListClient());

    await request(app.getHttpServer())
      .post('/api/user/logout')
      .expect(401)
      .expect({ errors: { token: ['is missing'] } });
  });

  it('fails closed when Redis cannot record a logout', async () => {
    const redis = new InMemoryDenyListClient();
    redis.set.mockRejectedValueOnce(new Error('offline'));
    app = await createApp(redis);

    await request(app.getHttpServer())
      .post('/api/user/logout')
      .set('Authorization', 'Token signed-token')
      .expect(500)
      .expect({ errors: { body: ['internal server error'] } });
  });
});

async function createApp(
  redis: TokenDenyListClient,
): Promise<INestApplication<App>> {
  const denyList = new TokenDenyListService(redis, () => 1_000_000);
  const authService = new AuthService(
    { transaction: async (work) => work({} as never) },
    { findByEmail: async () => null },
    undefined,
    { verify: async () => claims() },
    denyList,
  );
  @Module({
    controllers: [AuthController],
    providers: [
      AuthTokenGuard,
      { provide: AuthService, useValue: authService },
      { provide: UserService, useValue: { findByUsername: vi.fn() } },
      { provide: JwtService, useValue: { signAsync: vi.fn() } },
      {
        provide: AUTH_CONFIG,
        useValue: { audience: 'client', issuer: 'api', secret: 'secret' },
      },
      { provide: AUTH_LOGIN_RATE_LIMITER, useValue: {} as AuthLoginRateLimiter },
    ],
  })
  class LogoutTestModule {}

  const module = await Test.createTestingModule({
    imports: [LogoutTestModule],
  }).compile();
  const application = module.createNestApplication<App>();
  application.setGlobalPrefix('api');
  configureGlobalRequestHandling(application);
  await application.init();
  return application;
}

function claims() {
  return {
    aud: 'client',
    exp: 1_901,
    iat: 1_000,
    iss: 'api',
    jti: 'token-id',
    sub: 'jane',
  };
}

class InMemoryDenyListClient implements TokenDenyListClient {
  readonly values = new Map<string, string>();
  readonly get = vi.fn(async (key: string) => this.values.get(key) ?? null);
  readonly set = vi.fn(
    async (key: string, value: string, _mode: 'EX', _ttlSeconds: number) => {
      this.values.set(key, value);
    },
  );
}
