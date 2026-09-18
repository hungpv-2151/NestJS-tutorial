import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthController, AUTH_CONFIG } from '../src/auth/auth.controller.js';
import { AUTH_LOGIN_RATE_LIMITER } from '../src/auth/auth.constants.js';
import { AuthLoginRateLimitError } from '../src/auth/auth-login-rate-limiter.js';
import { AuthTokenGuard } from '../src/auth/auth-token.guard.js';
import { configureGlobalRequestHandling } from '../src/create-app.js';
import {
  AuthInvalidCredentialsError,
  AuthService,
} from '../src/auth/auth.service.js';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../src/users/user.service.js';

describe('POST /api/users (e2e)', () => {
  let app: INestApplication<App>;

  afterEach(async () => {
    await app?.close();
  });

  it('creates the user and returns the RealWorld response', async () => {
    const register = vi
      .fn()
      .mockResolvedValue({ email: 'jane@example.com', username: 'jane' });
    app = await createApp(register);

    await request(app.getHttpServer())
      .post('/api/users')
      .send({
        user: {
          email: 'jane@example.com',
          password: 'safe-password',
          username: 'jane',
        },
      })
      .expect(201)
      .expect({
        user: {
          bio: null,
          email: 'jane@example.com',
          image: null,
          token: 'signed-token',
          username: 'jane',
        },
      });

    expect(register).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'safe-password',
      username: 'jane',
    });
  });

  it('rejects malformed registration input before persistence', async () => {
    const register = vi.fn();
    app = await createApp(register);

    await request(app.getHttpServer())
      .post('/api/users')
      .send({ user: { email: 'not-an-email', password: 'short', username: '' } })
      .expect(422)
      .expect({
        errors: {
          email: ['is invalid'],
          password: ['is invalid'],
          username: ["can't be blank", 'is invalid'],
        },
      });

    expect(register).not.toHaveBeenCalled();
  });

  it('does not persist a user when token signing fails', async () => {
    const register = vi.fn();
    app = await createApp(register, vi.fn().mockRejectedValue(new Error('signer unavailable')));

    await request(app.getHttpServer())
      .post('/api/users')
      .send({
        user: {
          email: 'jane@example.com',
          password: 'safe-password',
          username: 'jane',
        },
      })
      .expect(500)
      .expect({ errors: { body: ['request failed'] } });

    expect(register).not.toHaveBeenCalled();
  });

  it('logs in an existing user', async () => {
    const login = vi.fn().mockResolvedValue({
      bio: null,
      email: 'jane@example.com',
      image: null,
      username: 'jane',
    });
    app = await createApp(vi.fn(), vi.fn().mockResolvedValue('signed-token'), login);

    await request(app.getHttpServer())
      .post('/api/users/login')
      .send({ user: { email: 'jane@example.com', password: 'safe-password' } })
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

    expect(login).toHaveBeenCalledWith('jane@example.com', 'safe-password');
  });

  it('rejects invalid login credentials', async () => {
    const login = vi.fn().mockRejectedValue(new AuthInvalidCredentialsError());
    app = await createApp(vi.fn(), vi.fn(), login);

    await request(app.getHttpServer())
      .post('/api/users/login')
      .send({ user: { email: 'jane@example.com', password: 'wrong-password' } })
      .expect(401)
      .expect({ errors: { credentials: ['invalid'] } });
  });

  it('limits login attempts by email and IP address', async () => {
    const login = vi.fn().mockRejectedValue(new AuthInvalidCredentialsError());
    let attempts = 0;
    app = await createApp(vi.fn(), vi.fn(), login, {
      consume: () => {
        attempts += 1;
        if (attempts > 5) {
          throw new AuthLoginRateLimitError();
        }
      },
    });
    const server = request(app.getHttpServer());

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await server
        .post('/api/users/login')
        .send({ user: { email: 'jane@example.com', password: 'wrong-password' } })
        .expect(401);
    }

    await server
      .post('/api/users/login')
      .send({ user: { email: 'jane@example.com', password: 'wrong-password' } })
      .expect(429)
      .expect({ errors: { body: ['too many requests'] } });
  });
});

async function createApp(
  register: ReturnType<typeof vi.fn>,
  signAsync = vi.fn().mockResolvedValue('signed-token'),
  login = vi.fn(),
  loginRateLimiter = { consume: vi.fn() },
): Promise<INestApplication<App>> {
  @Module({
    controllers: [AuthController],
    providers: [
      AuthTokenGuard,
      { provide: AUTH_LOGIN_RATE_LIMITER, useValue: loginRateLimiter },
      { provide: AuthService, useValue: { login, register } },
      { provide: JwtService, useValue: { signAsync } },
      { provide: UserService, useValue: { findByUsername: vi.fn() } },
      { provide: AUTH_CONFIG, useValue: { audience: 'client', issuer: 'api', secret: 'secret' } },
    ],
  })
  class AuthTestModule {}

  const module = await Test.createTestingModule({
    imports: [AuthTestModule],
  }).compile();
  const application = module.createNestApplication<App>();
  application.setGlobalPrefix('api');
  configureGlobalRequestHandling(application);
  await application.init();
  return application;
}
