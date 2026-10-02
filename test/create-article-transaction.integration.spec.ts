import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ArticleTag } from '../src/articles/article-tag.entity.js';
import { Article } from '../src/articles/article.entity.js';
import {
  ArticleCreatePersistenceError,
  ArticleCreateService,
} from '../src/articles/article-create.service.js';
import { Tag } from '../src/tags/tag.entity.js';
import { User } from '../src/users/user.entity.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? it : it.skip;
const fixture = {
  usernames: [] as string[],
  titles: [] as string[],
  tags: [] as string[],
};
let dataSource: DataSource | undefined;

describe('article creation transaction', () => {
  beforeAll(async () => {
    if (!databaseUrl) return;
    dataSource = new DataSource({
      type: 'postgres',
      url: databaseUrl,
      entities: [User, Article, ArticleTag, Tag],
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    if (!dataSource) return;
    for (const title of fixture.titles) {
      await dataSource.getRepository(Article).delete({ title });
    }
    for (const name of fixture.tags) {
      await dataSource.getRepository(Tag).delete({ name });
    }
    for (const username of fixture.usernames) {
      await dataSource.getRepository(User).delete({ username });
    }
    fixture.usernames.length = 0;
    fixture.titles.length = 0;
    fixture.tags.length = 0;
  });

  afterAll(async () => dataSource?.destroy());

  integration(
    'rolls back article and new tags when linking tags fails',
    async () => {
      const author = await createAuthor('rollback');
      const title = `Rollback ${randomUUID()}`;
      const tag = `rollback-${randomUUID()}`;
      fixture.titles.push(title);
      fixture.tags.push(tag);

      const service = new ArticleCreateService(
        dataSourceWithFailingTagInsert(),
      );

      await expect(
        service.create(author.username, articleRequest(title, [tag])),
      ).rejects.toBeInstanceOf(ArticleCreatePersistenceError);

      await expect(
        dataSource!.getRepository(Article).findBy({ title }),
      ).resolves.toEqual([]);
      await expect(
        dataSource!.getRepository(Tag).findBy({ name: In([tag]) }),
      ).resolves.toEqual([]);
    },
  );

  integration(
    'links concurrent article creations to one shared tag',
    async () => {
      const firstAuthor = await createAuthor('first');
      const secondAuthor = await createAuthor('second');
      const suffix = randomUUID();
      const titles = [
        `Concurrent first ${suffix}`,
        `Concurrent second ${suffix}`,
      ];
      const sharedTag = `shared-${suffix}`;
      fixture.titles.push(...titles);
      fixture.tags.push(sharedTag);

      const service = new ArticleCreateService(requireDataSource());
      const results = await Promise.all([
        service.create(
          firstAuthor.username,
          articleRequest(titles[0], [sharedTag]),
        ),
        service.create(
          secondAuthor.username,
          articleRequest(titles[1], [sharedTag]),
        ),
      ]);

      const storedTag = await dataSource!
        .getRepository(Tag)
        .findOneByOrFail({ name: sharedTag });
      const articles = await dataSource!
        .getRepository(Article)
        .findBy({ title: In(titles) });
      const links = await dataSource!
        .getRepository(ArticleTag)
        .findBy({ articleId: In(articles.map(({ id }) => id)) });

      expect(results).toHaveLength(2);
      expect(articles).toHaveLength(2);
      expect(links).toHaveLength(2);
      expect(new Set(links.map(({ tagId }) => tagId))).toEqual(
        new Set([storedTag.id]),
      );
    },
  );
});

async function createAuthor(label: string): Promise<User> {
  const suffix = randomUUID();
  const username = `article-${label}-${suffix}`;
  fixture.usernames.push(username);
  return requireDataSource()
    .getRepository(User)
    .save({
      username,
      email: `${username}@example.test`,
      passwordHash: 'integration-test-only-hash',
      bio: null,
      image: null,
    });
}

function dataSourceWithFailingTagInsert(): DataSource {
  const transaction = <T>(work: (manager: EntityManager) => Promise<T>) =>
    requireDataSource().transaction((manager) =>
      work({
        getRepository(entity: unknown) {
          if (entity !== ArticleTag) {
            return manager.getRepository(entity as never);
          }
          const repository = manager.getRepository(ArticleTag);
          return new Proxy(repository, {
            get(target, property, receiver) {
              if (property === 'insert') {
                return async () => {
                  throw new Error('forced article tag insert failure');
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

function articleRequest(title: string, tagList: string[]) {
  return {
    title,
    description: 'Integration test article',
    body: 'Integration test body',
    tagList,
  };
}

function requireDataSource(): DataSource {
  if (!dataSource) throw new Error('integration database is unavailable');
  return dataSource;
}
