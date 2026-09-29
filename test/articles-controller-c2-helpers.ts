import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource, In } from 'typeorm';
import { Tag } from '../src/tags/tag.entity.js';
import { User } from '../src/users/user.entity.js';

export interface RegisteredC2User {
  username: string;
  email: string;
  token: string;
}

export async function registerC2User(
  app: INestApplication,
  username: string,
): Promise<RegisteredC2User> {
  const email = `${username}@example.test`;
  const response = await request(app.getHttpServer())
    .post('/api/users')
    .send({ user: { username, email, password: 'C2-safe-password-123' } })
    .expect(201);
  expect(response.body.user).not.toHaveProperty('password');
  expect(response.body.user).not.toHaveProperty('passwordHash');
  return response.body.user as RegisteredC2User;
}

export async function createC2Article(
  app: INestApplication,
  token: string,
  title: string,
  tag: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/articles')
    .set({ Authorization: `Token ${token}` })
    .send({
      article: {
        title,
        description: 'C2 description',
        body: 'C2 body',
        tagList: [tag],
      },
    })
    .expect(201);
  return response.body.article.slug as string;
}

export function waitForDistinctCreationTime(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

export async function cleanupC2Fixtures(
  app: INestApplication | undefined,
  usernames: string[],
  tagName: string,
): Promise<void> {
  if (!app) return;
  try {
    if (usernames.length) {
      await app
        .get(DataSource)
        .getRepository(User)
        .delete({ username: In(usernames) });
    }
  } finally {
    if (tagName) {
      await app.get(DataSource).getRepository(Tag).delete({ name: tagName });
    }
  }
}
