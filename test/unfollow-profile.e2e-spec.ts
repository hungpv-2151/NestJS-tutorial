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
} from '../src/profiles/profile.service.js';
import { UserService } from '../src/users/user.service.js';

describe('DELETE /api/profiles/:username/follow (e2e)', () => {
  let app: INestApplication<App>;

  afterEach(async () => app?.close());

  it('unfollows a profile with an idempotent success response', async () => {
    const unfollow = vi.fn().mockResolvedValue(user());
    app = await createApp(unfollow);

    await request(app.getHttpServer())
      .delete('/api/profiles/jane/follow')
      .set('Authorization', 'Token signed-token')
      .expect(200)
      .expect({ profile: { ...user(), following: false } });

    expect(unfollow).toHaveBeenCalledWith('john', 'jane');
  });

  it('requires a token and reports unknown profiles', async () => {
    const unfollow = vi.fn().mockRejectedValue(new ProfileNotFoundError());
    app = await createApp(unfollow);
    const server = request(app.getHttpServer());

    await server.delete('/api/profiles/jane/follow').expect(401);
    await server
      .delete('/api/profiles/missing/follow')
      .set('Authorization', 'Token signed-token')
      .expect(404)
      .expect({ errors: { profile: ['not found'] } });
  });
});

async function createApp(unfollow: ReturnType<typeof vi.fn>) {
  @Module({
    controllers: [ProfilesController],
    providers: [
      AuthTokenGuard,
      {
        provide: AuthService,
        useValue: { authenticate: vi.fn().mockResolvedValue({ sub: 'john' }) },
      },
      { provide: ProfileService, useValue: { unfollow } },
      { provide: UserService, useValue: { findByUsername: vi.fn() } },
    ],
  })
  class UnfollowProfileTestModule {}

  const module = await Test.createTestingModule({
    imports: [UnfollowProfileTestModule],
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
