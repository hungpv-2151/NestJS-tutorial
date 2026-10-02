import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import { vi } from 'vitest';

import { AuthService } from '../src/auth/auth.service.js';
import { ArticleTag } from '../src/articles/article-tag.entity.js';
import { Article } from '../src/articles/article.entity.js';
import { Tag } from '../src/tags/tag.entity.js';
import { User } from '../src/users/user.entity.js';

export interface ArticleFixture {
  articleId: string;
  slug: string;
  authorId: string;
  authorUsername: string;
  viewerId: string;
  viewerUsername: string;
  tags: [string, string];
}

export async function createArticleFixture(
  dataSource: DataSource,
): Promise<ArticleFixture> {
  return dataSource.transaction(async (manager) => {
    const suffix = randomUUID();
    const authorUsername = `detail-author-${suffix}`;
    const viewerUsername = `detail-viewer-${suffix}`;
    const timestamp = new Date();
    const users = await manager.getRepository(User).save(
      [authorUsername, viewerUsername].map((username) => ({
        username,
        email: `${username}@example.test`,
        passwordHash: 'test-only-not-a-real-hash',
        bio: username === authorUsername ? 'Public bio' : null,
        updatedAt: timestamp,
      })),
    );
    const [author, viewer] = users;
    const slug = `article-detail-${suffix}`;
    const tags: [string, string] = [
      `detail-first-${suffix}`,
      `detail-second-${suffix}`,
    ];
    const article = await manager.getRepository(Article).save({
      slug,
      title: 'Article detail',
      description: 'Detail description',
      body: 'Detail body',
      authorId: author.id,
      updatedAt: timestamp,
    });
    const storedTags = await manager
      .getRepository(Tag)
      .save(tags.map((name) => ({ name })));
    await manager.getRepository(ArticleTag).insert(
      storedTags.map((tag, position) => ({
        articleId: article.id,
        tagId: tag.id,
        position,
      })),
    );
    return {
      articleId: article.id,
      slug,
      authorId: author.id,
      authorUsername,
      viewerId: viewer.id,
      viewerUsername,
      tags,
    };
  });
}

export async function cleanArticleFixture(
  dataSource: DataSource,
  fixture: ArticleFixture,
): Promise<void> {
  await dataSource.getRepository(Article).delete({ slug: fixture.slug });
  await dataSource.getRepository(Tag).delete({ name: In(fixture.tags) });
  await dataSource
    .getRepository(User)
    .delete({ id: In([fixture.authorId, fixture.viewerId]) });
}

export function authenticateAs(app: INestApplication, username: string): void {
  vi.spyOn(app.get(AuthService), 'authenticate').mockResolvedValue(
    tokenClaims(username),
  );
}

function tokenClaims(username: string) {
  return {
    aud: 'test',
    exp: 2_000_000_000,
    iat: 1_900_000_000,
    iss: 'test',
    jti: randomUUID(),
    sub: username,
  };
}
