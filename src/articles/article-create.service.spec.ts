import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';

import { User } from '../users/user.entity.js';
import { ArticleTag } from './article-tag.entity.js';
import { Article } from './article.entity.js';
import {
  ArticleAuthorNotFoundError,
  ArticleCreatePersistenceError,
  ArticleCreateService,
  ArticleSlugConflictError,
} from './article-create.service.js';
import { Tag } from '../tags/tag.entity.js';

const author = Object.assign(new User(), {
  id: 'author-id',
  username: 'writer',
  bio: null,
  image: null,
});

class UnexpectedRepositoryError extends Error {}

describe('ArticleCreateService', () => {
  it('saves an article and ordered unique tags in one transaction', async () => {
    const fixture = createFixture();

    const result = await fixture.service.create('writer', {
      title: 'Hello World',
      description: 'Description',
      body: 'Body',
      tagList: ['first', 'second', 'first'],
    });

    expect(fixture.transaction).toHaveBeenCalledTimes(1);
    expect(fixture.articleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        authorId: 'author-id',
        body: 'Body',
        description: 'Description',
        slug: expect.stringMatching(/^hello-world-[0-9a-f-]{36}$/),
        title: 'Hello World',
      }),
    );
    expect(fixture.tagValues).toHaveBeenCalledWith([
      { name: 'first' },
      { name: 'second' },
    ]);
    expect(fixture.articleTagInsert).toHaveBeenCalledWith([
      { articleId: 'article-id', tagId: 'tag-first', position: 0 },
      { articleId: 'article-id', tagId: 'tag-second', position: 1 },
    ]);
    expect(result).toMatchObject({
      article: {
        slug: expect.stringMatching(/^hello-world-[0-9a-f-]{36}$/),
        tagList: ['first', 'second'],
        author: { username: 'writer' },
      },
    });
  });

  it('does not persist an article when its author is missing', async () => {
    const fixture = createFixture({ author: null });

    await expect(
      fixture.service.create('missing', articleRequest()),
    ).rejects.toBeInstanceOf(ArticleAuthorNotFoundError);
    expect(fixture.articleSave).not.toHaveBeenCalled();
  });

  it('maps a unique slug violation to a conflict error', async () => {
    const fixture = createFixture({
      saveError: {
        driverError: { code: '23505', constraint: 'uq_articles_slug' },
      },
    });

    await expect(
      fixture.service.create('writer', articleRequest()),
    ).rejects.toBeInstanceOf(ArticleSlugConflictError);
  });

  it('allows duplicate titles and generates a unique slug for each article', async () => {
    const fixture = createFixture();

    const first = await fixture.service.create('writer', articleRequest());
    const second = await fixture.service.create('writer', articleRequest());

    expect(first.article.title).toBe(second.article.title);
    expect(first.article.slug).not.toBe(second.article.slug);
  });

  it('wraps other persistence failures without exposing them as article errors', async () => {
    const cause = new Error('database credentials must not escape');
    const fixture = createFixture({ saveError: cause });

    const result = fixture.service.create('writer', articleRequest());
    await expect(result).rejects.toBeInstanceOf(ArticleCreatePersistenceError);
    await expect(result).rejects.toMatchObject({ cause });
  });

  it('skips tag persistence when tagList is omitted', async () => {
    const fixture = createFixture();

    const result = await fixture.service.create('writer', articleRequest());

    expect(result.article.tagList).toEqual([]);
    expect(fixture.tagInsert).not.toHaveBeenCalled();
    expect(fixture.articleTagInsert).not.toHaveBeenCalled();
  });
});

function createFixture(
  options: {
    author?: User | null;
    saveError?: unknown;
  } = {},
) {
  const article = Object.assign(new Article(), {
    id: 'article-id',
    slug: 'hello-world-fixed-id',
    title: 'Hello World',
    description: 'Description',
    body: 'Body',
    authorId: 'author-id',
    createdAt: new Date('2026-09-28T00:00:00.000Z'),
    updatedAt: new Date('2026-09-28T00:00:00.000Z'),
  });
  const userRepository = {
    findOneBy: vi
      .fn()
      .mockResolvedValue(
        options.author === undefined ? author : options.author,
      ),
  };
  const articleRepository = {
    create: vi.fn((value) => value),
    save: vi.fn().mockImplementation(async (value) => {
      if (options.saveError) throw options.saveError;
      return { ...article, ...value };
    }),
  };
  const tagValues = vi.fn();
  const query = {
    insert: vi.fn(),
    values: tagValues,
    orIgnore: vi.fn(),
    execute: vi.fn().mockResolvedValue(undefined),
  };
  query.insert.mockReturnValue(query);
  query.values.mockReturnValue(query);
  query.orIgnore.mockReturnValue(query);
  const tagRepository = {
    createQueryBuilder: vi.fn().mockReturnValue(query),
    findBy: vi.fn().mockResolvedValue([
      { id: 'tag-first', name: 'first' },
      { id: 'tag-second', name: 'second' },
    ]),
  };
  const articleTagInsert = vi.fn().mockResolvedValue(undefined);
  const manager = {
    getRepository: (entity: unknown) => {
      if (entity === User) return userRepository;
      if (entity === Article) return articleRepository;
      if (entity === Tag) return tagRepository;
      if (entity === ArticleTag) return { insert: articleTagInsert };
      throw new UnexpectedRepositoryError('unexpected repository');
    },
  } as unknown as EntityManager;
  const transaction = vi.fn(
    async <T>(work: (manager: EntityManager) => Promise<T>) => work(manager),
  );
  const dataSource = { transaction } as unknown as DataSource;

  return {
    articleSave: articleRepository.save,
    articleTagInsert,
    service: new ArticleCreateService(dataSource),
    tagInsert: query.insert,
    tagValues,
    transaction,
  };
}

function articleRequest() {
  return { title: 'Hello World', description: 'Description', body: 'Body' };
}
