import { INestApplication, Module, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthTokenGuard } from '../src/auth/auth-token.guard.js';
import { AuthService } from '../src/auth/auth.service.js';
import { configureGlobalRequestHandling } from '../src/create-app.js';
import { FileReadController } from '../src/files/file-read.controller.js';
import { FileReadHandler } from '../src/files/file-read-handler.js';

describe('GET /api/files/:id (e2e)', () => {
  let app: INestApplication<App>;

  afterEach(async () => app?.close());

  it('requires authentication', async () => {
    const read = vi.fn();
    app = await createApp(read);

    await request(app.getHttpServer())
      .get('/api/files/attachment-id')
      .expect(401)
      .expect({ errors: { token: ['is missing'] } });
    expect(read).not.toHaveBeenCalled();
  });

  it('returns the owners bytes with safe private response headers', async () => {
    const read = vi.fn().mockResolvedValue({
      body: Buffer.from('private image'),
      byteSize: 13,
      mediaType: 'image/png',
    });
    app = await createApp(read);

    await request(app.getHttpServer())
      .get('/api/files/attachment-id')
      .set('Authorization', 'Token signed-token')
      .expect(200)
      .expect('Content-Type', 'image/png')
      .expect('Content-Length', '13')
      .expect('Cache-Control', /no-store/)
      .expect('X-Content-Type-Options', 'nosniff')
      .expect('Pragma', 'no-cache')
      .expect('Expires', '0')
      .expect((response) => {
        expect(Buffer.from(response.body)).toEqual(Buffer.from('private image'));
      });

    expect(read).toHaveBeenCalledWith('jane', 'attachment-id');
  });

  it('uses a non-disclosing 404 for unavailable files', async () => {
    const read = vi
      .fn()
      .mockRejectedValue(
        new NotFoundException({ errors: { file: ['not found'] } }),
      );
    app = await createApp(read);

    await request(app.getHttpServer())
      .get('/api/files/attachment-id')
      .set('Authorization', 'Token signed-token')
      .expect(404)
      .expect({ errors: { file: ['not found'] } })
      .expect((response) => {
        expect(response.text).not.toContain('storage/private');
        expect(response.text).not.toContain('opaque-random-key');
      });
  });
});

async function createApp(read: ReturnType<typeof vi.fn>) {
  @Module({
    controllers: [FileReadController],
    providers: [
      AuthTokenGuard,
      { provide: FileReadHandler, useValue: { execute: read } },
      {
        provide: AuthService,
        useValue: { authenticate: vi.fn().mockResolvedValue({ sub: 'jane' }) },
      },
    ],
  })
  class FileReadTestModule {}

  const module = await Test.createTestingModule({
    imports: [FileReadTestModule],
  }).compile();
  const application = module.createNestApplication<App>();
  application.setGlobalPrefix('api');
  configureGlobalRequestHandling(application);
  await application.init();
  return application;
}
