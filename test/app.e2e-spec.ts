import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createApp } from './../src/create-app.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createApp({ NODE_ENV: 'test' });
  });

  it('/api/hello (GET) responds in English by default', () => {
    return request(app.getHttpServer())
      .get('/api/hello')
      .expect(200)
      .expect({ message: 'Hello!', locale: 'en' });
  });

  it('/api/hello (GET) responds in Vietnamese when requested', () => {
    return request(app.getHttpServer())
      .get('/api/hello')
      .set('Accept-Language', 'vi-VN,vi;q=0.9')
      .expect(200)
      .expect({ message: 'Xin chào!', locale: 'vi' });
  });

  it('/api/hello (GET) falls back to English for unsupported locales', () => {
    return request(app.getHttpServer())
      .get('/api/hello')
      .set('Accept-Language', 'fr-FR')
      .expect(200)
      .expect({ message: 'Hello!', locale: 'en' });
  });

  it('exposes Swagger UI and its JSON document outside production', async () => {
    await request(app.getHttpServer()).get('/docs').expect(200);

    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);

    expect(response.body.paths['/api/hello'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'accept-language', in: 'header' }),
      ]),
    );
    expect(response.body.paths['/api/users'].post).toMatchObject({
      responses: {
        '201': expect.any(Object),
        '409': expect.any(Object),
        '422': expect.any(Object),
        '500': expect.any(Object),
      },
      summary: 'Register a new user',
      tags: expect.arrayContaining(['Authentication']),
    });
  });

  afterEach(async () => {
    await app.close();
  });
});

describe('createApp in production', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createApp({ NODE_ENV: 'production' });
  });

  afterEach(async () => {
    await app.close();
  });

  it('does not expose Swagger unless explicitly enabled', () => {
    return request(app.getHttpServer()).get('/docs').expect(404);
  });

  it('exposes Swagger when production configuration explicitly enables it', async () => {
    const enabledApp = await createApp({
      NODE_ENV: 'production',
      SWAGGER_ENABLED: 'true',
    });

    try {
      await request(enabledApp.getHttpServer()).get('/docs-json').expect(200);
    } finally {
      await enabledApp.close();
    }
  });
});
