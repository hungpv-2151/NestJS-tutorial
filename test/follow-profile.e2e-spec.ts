import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthTokenGuard } from '../src/auth/auth-token.guard.js';
import { AuthService } from '../src/auth/auth.service.js';
import { configureGlobalRequestHandling } from '../src/create-app.js';
import { ProfilesController } from '../src/profiles/profiles.controller.js';
import {
  ProfileNotFoundError,
  ProfileService,
  SelfFollowError,
} from '../src/profiles/profile.service.js';
import { UserService } from '../src/users/user.service.js';

describe('POST /api/profiles/:username/follow (e2e)', () => {
  let app: INestApplication<App>;

  afterEach(async () => app?.close());

  it('follows a profile and returns it as followed', async () => {
    const follow = vi.fn().mockResolvedValue(user());
    app = await createApp(follow);

    await request(app.getHttpServer())
      .post('/api/profiles/jane/follow')
      .set('Authorization', 'Token signed-token')
      .expect(200)
      .expect({ profile: { ...user(), following: true } });

    expect(follow).toHaveBeenCalledWith('john', 'jane');
  });

  it('requires a token and maps missing or self profiles to contract errors', async () => {
    const follow = vi.fn();
    app = await createApp(follow);
    const server = request(app.getHttpServer());

    await server.post('/api/profiles/jane/follow').expect(401);
    follow.mockRejectedValueOnce(new ProfileNotFoundError());
    await server
      .post('/api/profiles/missing/follow')
      .set('Authorization', 'Token signed-token')
      .expect(404)
      .expect({ errors: { profile: ['not found'] } });
    follow.mockRejectedValueOnce(new SelfFollowError());
    await server
      .post('/api/profiles/john/follow')
      .set('Authorization', 'Token signed-token')
      .expect(422)
      .expect({ errors: { profile: ['cannot follow yourself'] } });
  });
});

async function createApp(follow: ReturnType<typeof vi.fn>) {
  @Module({
    controllers: [ProfilesController],
    providers: [
      AuthTokenGuard,
      { provide: AuthService, useValue: { authenticate: vi.fn().mockResolvedValue({ sub: 'john' }) } },
      { provide: ProfileService, useValue: { follow } },
      { provide: UserService, useValue: { findByUsername: vi.fn() } },
    ],
  })
  class FollowProfileTestModule {}

  const module = await Test.createTestingModule({
    imports: [FollowProfileTestModule],
  }).compile();
  const app = module.createNestApplication<App>();
  app.setGlobalPrefix('api');
  configureGlobalRequestHandling(app);
  await app.init();
  return app;
}

function user() {
  return { bio: null, image: null, username: 'jane' };
}
