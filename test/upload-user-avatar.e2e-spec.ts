import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserAvatarController } from '../src/auth/user-avatar.controller.js';
import { AuthTokenGuard } from '../src/auth/auth-token.guard.js';
import { AuthService } from '../src/auth/auth.service.js';
import { UserAvatarHandler } from '../src/auth/user-avatar-handler.js';
import { configureGlobalRequestHandling } from '../src/create-app.js';

describe('PUT /api/user/avatar (e2e)', () => {
  let app: INestApplication<App>;

  afterEach(async () => app?.close());

  it('requires authentication', async () => {
    const upload = vi.fn();
    app = await createApp(upload);

    await request(app.getHttpServer())
      .put('/api/user/avatar')
      .attach('avatar', png(), 'avatar.png')
      .expect(401)
      .expect({ errors: { token: ['is missing'] } });
    expect(upload).not.toHaveBeenCalled();
  });

  it('passes the multipart avatar and authenticated user to the handler', async () => {
    const upload = vi.fn().mockResolvedValue({
      user: {
        bio: null,
        email: 'jane@example.com',
        image: '/api/files/attachment-id',
        token: 'signed-token',
        username: 'jane',
      },
    });
    app = await createApp(upload);
    const server = request(app.getHttpServer());

    await server
      .put('/api/user/avatar')
      .set('Authorization', 'Token signed-token')
      .attach('avatar', png(), { contentType: 'text/plain', filename: 'avatar.txt' })
      .expect(200)
      .expect((response) => {
        expect(response.body.user.image).toBe('/api/files/attachment-id');
      });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0]).toBe('jane');
    expect(upload.mock.calls[0][1]).toBe('signed-token');
    expect(upload.mock.calls[0][2].buffer).toEqual(png());
  });

  it('rejects an avatar above 2 MiB before running the handler', async () => {
    const upload = vi.fn();
    app = await createApp(upload);

    await request(app.getHttpServer())
      .put('/api/user/avatar')
      .set('Authorization', 'Token signed-token')
      .attach('avatar', Buffer.alloc(2 * 1024 * 1024 + 1), 'large.png')
      .expect(422)
      .expect({ errors: { avatar: ['is too large'] } });

    expect(upload).not.toHaveBeenCalled();
  });
});

async function createApp(upload: ReturnType<typeof vi.fn>) {
  @Module({
    controllers: [UserAvatarController],
    providers: [
      AuthTokenGuard,
      { provide: UserAvatarHandler, useValue: { execute: upload } },
      {
        provide: AuthService,
        useValue: {
          authenticate: vi.fn().mockResolvedValue({ sub: 'jane' }),
        },
      },
    ],
  })
  class AvatarUploadTestModule {}

  const module = await Test.createTestingModule({
    imports: [AvatarUploadTestModule],
  }).compile();
  const application = module.createNestApplication<App>();
  application.setGlobalPrefix('api');
  configureGlobalRequestHandling(application);
  await application.init();
  return application;
}

function png(): Buffer {
  return Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
}
