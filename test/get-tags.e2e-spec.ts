import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { DataSource, In } from 'typeorm';

import { createApp } from '../src/create-app.js';
import { Tag } from '../src/tags/tag.entity.js';

describe('GET /api/tags (e2e)', () => {
  let app: INestApplication;
  let fixtureNames: string[] = [];

  afterEach(async () => {
    try {
      if (app && fixtureNames.length > 0) {
        await app
          .get(DataSource)
          .getRepository(Tag)
          .delete({ name: In(fixtureNames) });
      }
    } finally {
      await app?.close();
      fixtureNames = [];
    }
  });

  it('returns public tag names in stable order and documents the response', async () => {
    app = await createApp({ ...process.env, NODE_ENV: 'test' });
    const suffix = randomUUID();
    const first = `tags-a-${suffix}`;
    const last = `tags-z-${suffix}`;
    fixtureNames = [last, first];
    await app
      .get(DataSource)
      .getRepository(Tag)
      .insert(fixtureNames.map((name) => ({ name })));

    const response = await request(app.getHttpServer())
      .get('/api/tags')
      .expect(200);
    const tags = response.body.tags as string[];

    expect(response.body).toEqual({ tags: expect.any(Array) });
    expect(tags).toEqual(expect.arrayContaining(fixtureNames));
    expect(tags.indexOf(first)).toBeLessThan(tags.indexOf(last));
    expect(tags.every((tag) => typeof tag === 'string')).toBe(true);

    const docs = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const operation = docs.body.paths['/api/tags'].get;
    expect(
      operation.responses['200'].content['application/json'].schema,
    ).toMatchObject({
      required: ['tags'],
      properties: { tags: { type: 'array', items: { type: 'string' } } },
    });
    expect(operation.security).toBeUndefined();
  });
});
