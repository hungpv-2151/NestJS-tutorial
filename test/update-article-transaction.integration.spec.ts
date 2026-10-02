import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ArticleTag } from '../src/articles/article-tag.entity.js';
import { Article } from '../src/articles/article.entity.js';
import { ArticleFavorite } from '../src/articles/article-favorite.entity.js';
import {
  ArticleUpdatePersistenceError,
  ArticleUpdateService,
} from '../src/articles/article-update.service.js';
import { Tag } from '../src/tags/tag.entity.js';
import { User } from '../src/users/user.entity.js';
import { UserFollow } from '../src/profiles/user-follow.entity.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? it : it.skip;
const fixture = { usernames: [] as string[], slugs: [] as string[], tags: [] as string[] };
let dataSource: DataSource | undefined;

describe('article update transaction', () => {
  beforeAll(async () => {
    if (!databaseUrl) return;
    dataSource = new DataSource({
      type: 'postgres',
      url: databaseUrl,
      entities: [User, Article, ArticleTag, ArticleFavorite, UserFollow, Tag],
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    if (!dataSource) return;
    for (const slug of fixture.slugs) {
      await dataSource.getRepository(Article).delete({ slug });
    }
    for (const name of fixture.tags) {
      await dataSource.getRepository(Tag).delete({ name });
    }
    for (const username of fixture.usernames) {
      await dataSource.getRepository(User).delete({ username });
    }
    fixture.usernames.length = 0;
    fixture.slugs.length = 0;
    fixture.tags.length = 0;
  });

  afterAll(async () => dataSource?.destroy());

  integration('rolls back scalar and tag changes when replacement fails after deleting old links', async () => {
    const author = await createAuthor();
    const suffix = randomUUID();
    const slug = `update-rollback-${suffix}`;
    const oldTag = `update-old-${suffix}`;
    const newTag = `update-new-${suffix}`;
    fixture.slugs.push(slug);
    fixture.tags.push(oldTag, newTag);
    const tags = await requireDataSource().getRepository(Tag).save([
      { name: oldTag },
      { name: newTag },
    ]);
    const article = await requireDataSource().getRepository(Article).save({
      slug,
      title: 'Before',
      description: 'Description before',
      body: 'Body before',
      authorId: author.id,
    });
    await requireDataSource().getRepository(ArticleTag).insert({
      articleId: article.id,
      tagId: tags[0].id,
      position: 0,
    });
    const service = new ArticleUpdateService(dataSourceWithFailureAfterLinkDelete());

    await expect(
      service.update(slug, author.username, {
        title: 'After',
        tagList: [newTag],
      }),
    ).rejects.toBeInstanceOf(ArticleUpdatePersistenceError);

    const unchanged = await requireDataSource()
      .getRepository(Article)
      .findOneByOrFail({ id: article.id });
    expect(unchanged.title).toBe('Before');
    const links = await requireDataSource()
      .getRepository(ArticleTag)
      .findBy({ articleId: article.id });
    expect(links).toHaveLength(1);
    expect(links[0].tagId).toBe(tags[0].id);
    expect(await requireDataSource().getRepository(Tag).findBy({ name: In([oldTag, newTag]) })).toHaveLength(2);
  });

  integration('serializes concurrent scalar and tag replacements without mixed state', async () => {
    const author = await createAuthor();
    const suffix = randomUUID();
    const slug = `update-concurrent-${suffix}`;
    const tags = [`update-concurrent-a-${suffix}`, `update-concurrent-b-${suffix}`];
    fixture.slugs.push(slug);
    fixture.tags.push(...tags);
    const article = await requireDataSource().getRepository(Article).save({
      slug,
      title: 'Initial title',
      description: 'Initial description',
      body: 'Initial body',
      authorId: author.id,
    });
    const service = new ArticleUpdateService(requireDataSource());

    const results = await Promise.all([
      service.update(slug, author.username, {
        title: 'Concurrent title A',
        body: 'Concurrent body A',
        tagList: [tags[0]],
      }),
      service.update(slug, author.username, {
        title: 'Concurrent title B',
        body: 'Concurrent body B',
        tagList: [tags[1]],
      }),
    ]);

    expect(results).toHaveLength(2);
    const stored = await requireDataSource()
      .getRepository(Article)
      .findOneByOrFail({ id: article.id });
    const link = await requireDataSource()
      .getRepository(ArticleTag)
      .findOneByOrFail({ articleId: article.id });
    const tag = await requireDataSource()
      .getRepository(Tag)
      .findOneByOrFail({ id: link.tagId });
    const persistedState = [stored.title, stored.body, tag.name];

    expect([
      ['Concurrent title A', 'Concurrent body A', tags[0]],
      ['Concurrent title B', 'Concurrent body B', tags[1]],
    ]).toContainEqual(persistedState);
    expect(
      await requireDataSource()
        .getRepository(ArticleTag)
        .countBy({ articleId: article.id }),
    ).toBe(1);
  });
});

async function createAuthor(): Promise<User> {
  const suffix = randomUUID();
  const username = `update-author-${suffix}`;
  fixture.usernames.push(username);
  return requireDataSource().getRepository(User).save({
    username,
    email: `${username}@example.test`,
    passwordHash: 'integration-test-only-hash',
  });
}

function dataSourceWithFailureAfterLinkDelete(): DataSource {
  const transaction = <T>(work: (manager: EntityManager) => Promise<T>) =>
    requireDataSource().transaction((manager) =>
      work({
        getRepository(entity: unknown) {
          if (entity !== ArticleTag) return manager.getRepository(entity as never);
          const repository = manager.getRepository(ArticleTag);
          return new Proxy(repository, {
            get(target, property, receiver) {
              if (property === 'delete') {
                return async (...args: Parameters<typeof target.delete>) => {
                  await target.delete(...args);
                  throw new Error('forced failure after article tag deletion');
                };
              }
              const value = Reflect.get(target, property, receiver);
              return typeof value === 'function' ? value.bind(target) : value;
            },
          });
        },
      } as unknown as EntityManager),
    );
  return { transaction } as unknown as DataSource;
}

function requireDataSource(): DataSource {
  if (!dataSource) throw new Error('integration database is unavailable');
  return dataSource;
}
