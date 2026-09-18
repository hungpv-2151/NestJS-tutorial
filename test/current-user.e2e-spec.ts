import { INestApplication, Module } from '@nestjs/common';
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
import { JwtService } from '@nestjs/jwt';

describe('GET /api/user (e2e)', () => {
  let app: INestApplication<App>;

  afterEach(async () => {
    await app?.close();
  });

  it('returns the authenticated user and the presented token', async () => {
    app = await createApp();

    await request(app.getHttpServer())
      .get('/api/user')
      .set('Authorization', 'Token signed-token')
      .expect(200)
      .expect({
        user: {
          bio: null,
          email: 'jane@example.com',
          image: null,
          token: 'signed-token',
          username: 'jane',
        },
      });
  });

  it('rejects a missing or invalid token', async () => {
    app = await createApp(
      vi.fn().mockRejectedValue(new AuthInvalidTokenError()),
    );

    await request(app.getHttpServer())
      .get('/api/user')
      .expect(401)
      .expect({ errors: { token: ['is missing'] } });

    await request(app.getHttpServer())
      .get('/api/user')
      .set('Authorization', 'Token invalid-token')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
  });

  it('rejects a token for a user that no longer exists', async () => {
    app = await createApp(undefined, vi.fn().mockRejectedValue(new AuthInvalidTokenError()));

    await request(app.getHttpServer())
      .get('/api/user')
      .set('Authorization', 'Token signed-token')
      .expect(401)
      .expect({ errors: { token: ['is invalid'] } });
  });
});

async function createApp(
  authenticate = vi.fn().mockResolvedValue({ sub: 'jane' }),
  currentUser = vi.fn().mockResolvedValue(user()),
): Promise<INestApplication<App>> {
  @Module({
    controllers: [AuthController],
    providers: [
      AuthTokenGuard,
      { provide: AuthService, useValue: { authenticate, currentUser } },
      { provide: JwtService, useValue: { signAsync: vi.fn() } },
      { provide: AUTH_CONFIG, useValue: { audience: 'client', issuer: 'api', secret: 'secret' } },
      { provide: AUTH_LOGIN_RATE_LIMITER, useValue: {} as AuthLoginRateLimiter },
    ],
  })
  class AuthTestModule {}

  const module = await Test.createTestingModule({ imports: [AuthTestModule] }).compile();
  const application = module.createNestApplication<App>();
  application.setGlobalPrefix('api');
  configureGlobalRequestHandling(application);
  await application.init();
  return application;
}

function user() {
  return {
    bio: null,
    email: 'jane@example.com',
    image: null,
    username: 'jane',
  };
}
