import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/create-app.js';
import { removeTestWelcomeMailQueue } from './welcome-mail-queue-cleaner.js';
import {
  cleanupC2Fixtures,
  createC2Article,
  registerC2User,
  waitForDistinctCreationTime,
} from './articles-controller-c2-helpers.js';

describe('ArticlesController C2 journey (e2e)', () => {
  let app: INestApplication | undefined;
  let users: string[] = [];
  let tagName = '';
  let queueName = '';

  afterEach(async () => {
    try {
      await cleanupC2Fixtures(app, users, tagName);
    } finally {
      try {
        await app?.close();
      } finally {
        try {
          if (queueName) await removeTestWelcomeMailQueue(queueName);
        } finally {
          app = undefined;
          users = [];
          tagName = '';
          queueName = '';
        }
      }
    }
  });

  it('registers, creates, filters, personalizes, updates and deletes an article', async () => {
    const suffix = randomUUID();
    queueName = `welcome-mail-c2-${suffix}`;
    const previousQueueName = process.env.WELCOME_MAIL_QUEUE_NAME;
    process.env.WELCOME_MAIL_QUEUE_NAME = queueName;
    try {
      app = await createApp({ ...process.env, NODE_ENV: 'test' });
    } finally {
      if (previousQueueName === undefined) {
        delete process.env.WELCOME_MAIL_QUEUE_NAME;
      } else {
        process.env.WELCOME_MAIL_QUEUE_NAME = previousQueueName;
      }
    }
    const authorUsername = `c2-author-${suffix}`;
    const readerUsername = `c2-reader-${suffix}`;
    users.push(authorUsername, readerUsername);
    const author = await registerC2User(app, authorUsername);
    const reader = await registerC2User(app, readerUsername);
    const auth = (user: { token: string }) => ({
      Authorization: `Token ${user.token}`,
    });
    tagName = `c2-tag-${suffix}`;

    const created = await request(app.getHttpServer())
      .post('/api/articles')
      .set(auth(author))
      .send({
        article: {
          title: `C2 Article ${suffix}`,
          description: 'C2 description',
          body: 'C2 body',
          tagList: [tagName],
        },
      })
      .expect(201);
    const { slug } = created.body.article;
    expect(created.body.article).toMatchObject({
      body: 'C2 body',
      favorited: false,
      favoritesCount: 0,
      tagList: [tagName],
      author: { username: author.username },
    });

    const nextSlug = await createC2Article(
      app,
      author.token,
      `C2 next ${suffix}`,
      tagName,
    );
    await waitForDistinctCreationTime();
    const newestSlug = await createC2Article(
      app,
      author.token,
      `C2 newest ${suffix}`,
      tagName,
    );

    await request(app.getHttpServer())
      .post(`/api/profiles/${author.username}/follow`)
      .set(auth(reader))
      .expect(200);
    const detail = await request(app.getHttpServer())
      .get(`/api/articles/${slug}`)
      .expect(200);
    expect(detail.body.article.body).toBe('C2 body');

    const page = await request(app.getHttpServer())
      .get('/api/articles')
      .query({ tag: tagName, author: author.username, limit: 1, offset: 0 })
      .expect(200);
    expect(page.body.articlesCount).toBe(3);
    expect(
      page.body.articles.map((article: { slug: string }) => article.slug),
    ).toEqual([newestSlug]);
    const nextPage = await request(app.getHttpServer())
      .get('/api/articles')
      .query({ tag: tagName, author: author.username, limit: 1, offset: 1 })
      .expect(200);
    const finalPage = await request(app.getHttpServer())
      .get('/api/articles')
      .query({ tag: tagName, author: author.username, limit: 1, offset: 2 })
      .expect(200);
    expect(
      nextPage.body.articles.map((article: { slug: string }) => article.slug),
    ).toEqual([nextSlug]);
    expect(
      finalPage.body.articles.map((article: { slug: string }) => article.slug),
    ).toEqual([slug]);
    expect(page.body.articles[0]).toMatchObject({ favorited: false });
    expect(page.body.articles[0]).not.toHaveProperty('body');

    const favorite = await request(app.getHttpServer())
      .post(`/api/articles/${slug}/favorite`)
      .set(auth(reader))
      .expect(200);
    expect(favorite.body.article).toMatchObject({
      favorited: true,
      favoritesCount: 1,
    });
    const feed = await request(app.getHttpServer())
      .get('/api/articles/feed')
      .set(auth(reader))
      .expect(200);
    expect(
      feed.body.articles.map((article: { slug: string }) => article.slug),
    ).toContain(slug);

    const filtered = await request(app.getHttpServer())
      .get('/api/articles')
      .query({ favorited: reader.username })
      .expect(200);
    expect(
      filtered.body.articles.map((article: { slug: string }) => article.slug),
    ).toContain(slug);

    await request(app.getHttpServer())
      .delete(`/api/articles/${slug}/favorite`)
      .set(auth(reader))
      .expect(200)
      .expect(({ body }) =>
        expect(body.article).toMatchObject({
          favorited: false,
          favoritesCount: 0,
        }),
      );
    await request(app.getHttpServer())
      .put(`/api/articles/${slug}`)
      .set(auth(reader))
      .send({ article: { title: 'Unauthorized update' } })
      .expect(403)
      .expect({ errors: { article: ['forbidden'] } });

    const updated = await request(app.getHttpServer())
      .put(`/api/articles/${slug}`)
      .set(auth(author))
      .send({
        article: { title: 'Updated C2 article', body: 'Updated C2 body' },
      })
      .expect(200);
    expect(updated.body.article).toMatchObject({
      title: 'Updated C2 article',
      body: 'Updated C2 body',
    });

    const deleted = await request(app.getHttpServer())
      .delete(`/api/articles/${slug}`)
      .set(auth(author))
      .expect(204);
    expect(deleted.text).toBe('');
    await request(app.getHttpServer())
      .get(`/api/articles/${slug}`)
      .expect(404)
      .expect({ errors: { article: ['not found'] } });
  }, 30_000);
});
