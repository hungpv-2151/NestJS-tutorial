import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataSource, In } from 'typeorm';

import { AuthService } from '../src/auth/auth.service.js';
import { ArticleTag } from '../src/articles/article-tag.entity.js';
import { Article } from '../src/articles/article.entity.js';
import { createApp } from '../src/create-app.js';
import { Tag } from '../src/tags/tag.entity.js';
import { User } from '../src/users/user.entity.js';

describe('POST /api/articles (e2e)', () => {
  let app: INestApplication;
  let fixture: { username: string; title: string; tags: string[] } | undefined;

  afterEach(async () => {
    try {
      if (app && fixture) {
        const createdFixture = fixture;
        await app.get(DataSource).transaction(async (manager) => {
          await manager
            .getRepository(Article)
            .delete({ title: createdFixture.title });
          await manager
            .getRepository(Tag)
            .delete({ name: In(createdFixture.tags) });
          await manager
            .getRepository(User)
            .delete({ username: createdFixture.username });
        });
      }
    } finally {
      await app?.close();
      fixture = undefined;
    }
  });

  it('requires authentication', async () => {
    app = await createApp({ NODE_ENV: 'test' });

    await request(app.getHttpServer())
      .post('/api/articles')
      .expect(401)
      .expect({ errors: { token: ['is missing'] } });
  });

  it('validates the request body before calling article creation', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    authenticateAs(app, 'writer');

    await request(app.getHttpServer())
      .post('/api/articles')
      .set('Authorization', 'Token test-token')
      .send({
        article: { title: ' ', description: 'Description', body: 'Body' },
      })
      .expect(422)
      .expect((response) => {
        expect(response.body.errors).toHaveProperty('title');
      });

    await request(app.getHttpServer())
      .post('/api/articles')
      .set('Authorization', 'Token test-token')
      .send({
        article: {
          title: 'Title',
          description: 'Description',
          body: 'Body',
          tagList: ['valid', 42],
        },
      })
      .expect(422)
      .expect((response) => {
        expect(response.body.errors).toHaveProperty('tagList');
      });
  });

  it('creates an authenticated article and persists ordered unique tags', async () => {
    app = await createApp({ NODE_ENV: 'test' });
    const dataSource = app.get(DataSource);
    const suffix = randomUUID();
    fixture = {
      username: `article-${suffix}`,
      title: `Article ${suffix}`,
      tags: [`tag-${suffix}-second`, `tag-${suffix}-first`],
    };
    const author = await dataSource.getRepository(User).save({
      username: fixture.username,
      email: `${fixture.username}@example.test`,
      passwordHash: 'test-only-not-a-real-hash',
    });
    authenticateAs(app, fixture.username);

    const response = await request(app.getHttpServer())
      .post('/api/articles')
      .set('Authorization', 'Token test-token')
      .send({
        article: {
          title: fixture.title,
          description: 'Article description',
          body: 'Article body',
          tagList: [...fixture.tags, fixture.tags[0]],
        },
      })
      .expect(201);

    expect(response.body.article).toMatchObject({
      title: fixture.title,
      description: 'Article description',
      body: 'Article body',
      tagList: fixture.tags,
      favorited: false,
      favoritesCount: 0,
      author: {
        username: fixture.username,
        bio: null,
        image: null,
        following: false,
      },
    });
    expect(response.body.article.slug).toMatch(
      /^article-[a-f0-9-]+-[a-f0-9-]{36}$/,
    );
    expect(response.body.article.createdAt).toEqual(expect.any(String));
    expect(response.body.article.updatedAt).toEqual(expect.any(String));

    const article = await dataSource
      .getRepository(Article)
      .findOneByOrFail({ slug: response.body.article.slug });
    expect(article.authorId).toBe(author.id);
    expect(article.body).toBe('Article body');

    const articleTags = await dataSource
      .getRepository(ArticleTag)
      .findBy({ articleId: article.id });
    expect(articleTags).toHaveLength(2);
    const storedTags = await dataSource
      .getRepository(Tag)
      .findBy({ id: In(articleTags.map(({ tagId }) => tagId)) });
    const tagNameById = new Map(storedTags.map(({ id, name }) => [id, name]));
    expect(
      [...articleTags]
        .sort((left, right) => left.position - right.position)
        .map(({ tagId }) => tagNameById.get(tagId)),
    ).toEqual(fixture.tags);
  });
});

function authenticateAs(app: INestApplication, username: string): void {
  const authService = app.get(AuthService);
  vi.spyOn(authService, 'authenticate').mockResolvedValue({
    aud: 'test',
    exp: 2_000_000_000,
    iat: 1_900_000_000,
    iss: 'test',
    jti: randomUUID(),
    sub: username,
  });
}
