import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterEach, describe, it, vi } from 'vitest';

import { configureGlobalRequestHandling } from '../src/create-app.js';
import { AuthTokenGuard } from '../src/auth/auth-token.guard.js';
import { AuthService } from '../src/auth/auth.service.js';
import { ProfilesController } from '../src/profiles/profiles.controller.js';
import { ProfileService } from '../src/profiles/profile.service.js';
import { UserService } from '../src/users/user.service.js';

describe('GET /api/profiles/:username (e2e)', () => {
  let app: INestApplication<App>;

  afterEach(async () => app?.close());

  it('returns a public profile anonymously or with a token header', async () => {
    app = await createApp(user());
    const server = request(app.getHttpServer());
    const expected = {
      profile: {
        bio: 'About Jane',
        following: false,
        image: 'https://example.com/jane.jpg',
        username: 'jane',
      },
    };

    await server.get('/api/profiles/jane').expect(200).expect(expected);
    await server
      .get('/api/profiles/jane')
      .set('Authorization', 'Token optional-token')
      .expect(200)
      .expect(expected);
  });

  it('returns the RealWorld profile error for an unknown username', async () => {
    app = await createApp(null);

    await request(app.getHttpServer())
      .get('/api/profiles/missing')
      .expect(404)
      .expect({ errors: { profile: ['not found'] } });
  });
});

async function createApp(user: ReturnType<typeof user> | null) {
  const findByUsername = vi.fn().mockResolvedValue(user);

  @Module({
    controllers: [ProfilesController],
    providers: [
      AuthTokenGuard,
      { provide: AuthService, useValue: { authenticate: vi.fn() } },
      { provide: UserService, useValue: { findByUsername } },
      { provide: ProfileService, useValue: {} },
    ],
  })
  class ProfilesTestModule {}

  const module = await Test.createTestingModule({
    imports: [ProfilesTestModule],
  }).compile();
  const app = module.createNestApplication<App>();
  app.setGlobalPrefix('api');
  configureGlobalRequestHandling(app);
  await app.init();
  return app;
}

function user() {
  return {
    bio: 'About Jane',
    image: 'https://example.com/jane.jpg',
    username: 'jane',
  } as never;
}
