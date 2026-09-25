import { INestApplication, Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AUTH_CONFIG, AuthController } from '../src/auth/auth.controller.js';
import { AUTH_LOGIN_RATE_LIMITER } from '../src/auth/auth.constants.js';
import { AuthTokenGuard } from '../src/auth/auth-token.guard.js';
import { AuthCurrentUserHandler } from '../src/auth/auth-current-user-handler.js';
import { AuthUpdateUserHandler } from '../src/auth/auth-update-user-handler.js';
import { AuthService } from '../src/auth/auth.service.js';
import { configureGlobalRequestHandling } from '../src/create-app.js';
import {
  UserService,
  UserUpdateConflictError,
} from '../src/users/user.service.js';

describe('PUT /api/user (e2e)', () => {
  let app: INestApplication<App>;

  afterEach(async () => app?.close());

  it('updates the current user and returns a newly issued token', async () => {
    const updateCurrentUser = vi.fn().mockResolvedValue(user());
    app = await createApp(updateCurrentUser);

    await request(app.getHttpServer())
      .put('/api/user')
      .set('Authorization', 'Token signed-token')
      .send({ user: { bio: 'Updated bio' } })
      .expect(200)
      .expect({ user: { ...user(), token: 'updated-token' } });

    expect(updateCurrentUser).toHaveBeenCalledWith('jane', {
      bio: 'Updated bio',
    });
  });

  it('rejects missing authentication and malformed updates', async () => {
    const updateCurrentUser = vi.fn();
    app = await createApp(updateCurrentUser);
    const server = request(app.getHttpServer());

    await server
      .put('/api/user')
      .send({ user: { bio: 'Updated bio' } })
      .expect(401)
      .expect({ errors: { token: ['is missing'] } });
    await server
      .put('/api/user')
      .set('Authorization', 'Token signed-token')
      .send({ user: { username: '' } })
      .expect(422);

    expect(updateCurrentUser).not.toHaveBeenCalled();
  });

  it('returns a conflict when email or username is taken', async () => {
    app = await createApp(
      vi.fn().mockRejectedValue(new UserUpdateConflictError('email')),
    );

    await request(app.getHttpServer())
      .put('/api/user')
      .set('Authorization', 'Token signed-token')
      .send({ user: { email: 'taken@example.com' } })
      .expect(409)
      .expect({ errors: { email: ['has already been taken'] } });
  });

  it('does not persist when issuing the replacement token fails', async () => {
    const updateCurrentUser = vi.fn();
    app = await createApp(
      updateCurrentUser,
      vi.fn().mockRejectedValue(new Error('signer unavailable')),
    );

    await request(app.getHttpServer())
      .put('/api/user')
      .set('Authorization', 'Token signed-token')
      .send({ user: { username: 'janet' } })
      .expect(500);

    expect(updateCurrentUser).not.toHaveBeenCalled();
  });

  it('accepts the reissued token for the renamed user', async () => {
    const renamedUser = { ...user(), username: 'janet' };
    const updateCurrentUser = vi.fn().mockResolvedValue(renamedUser);
    const findByUsername = vi.fn().mockResolvedValue(renamedUser);
    app = await createApp(
      updateCurrentUser,
      vi.fn().mockResolvedValue('renamed-token'),
      findByUsername,
      vi.fn().mockImplementation(async (token) => ({
        sub: token === 'renamed-token' ? 'janet' : 'jane',
      })),
    );

    await request(app.getHttpServer())
      .put('/api/user')
      .set('Authorization', 'Token signed-token')
      .send({ user: { username: 'janet' } })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/user')
      .set('Authorization', 'Token renamed-token')
      .expect(200)
      .expect({ user: { ...renamedUser, token: 'renamed-token' } });

    expect(findByUsername).toHaveBeenCalledWith('janet');
  });
});

async function createApp(
  updateCurrentUser: ReturnType<typeof vi.fn>,
  signAsync = vi.fn().mockResolvedValue('updated-token'),
  findByUsername = vi.fn(),
  authenticate = vi.fn().mockResolvedValue({ sub: 'jane' }),
): Promise<INestApplication<App>> {
  @Module({
    controllers: [AuthController],
    providers: [
      AuthTokenGuard,
      AuthCurrentUserHandler,
      AuthUpdateUserHandler,
      {
        provide: AuthService,
        useValue: { authenticate, currentUser: (username: string) => findByUsername(username) },
      },
      { provide: UserService, useValue: { findByUsername, updateCurrentUser } },
      {
        provide: JwtService,
        useValue: { signAsync },
      },
      { provide: AUTH_LOGIN_RATE_LIMITER, useValue: {} },
      {
        provide: AUTH_CONFIG,
        useValue: { audience: 'client', issuer: 'api', secret: 'secret' },
      },
    ],
  })
  class UpdateUserTestModule {}

  const module = await Test.createTestingModule({
    imports: [UpdateUserTestModule],
  }).compile();
  const application = module.createNestApplication<App>();
  application.setGlobalPrefix('api');
  configureGlobalRequestHandling(application);
  await application.init();
  return application;
}

function user() {
  return {
    bio: 'Updated bio',
    email: 'jane@example.com',
    image: null,
    username: 'jane',
  };
}
