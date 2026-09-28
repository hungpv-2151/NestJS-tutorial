import { afterEach, describe, expect, it, vi } from 'vitest';

describe('data source', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('registers all schema migrations without schema synchronization', async () => {
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://user:password@localhost:5432/nestjs_tutorial',
    );

    const { default: dataSource } = await import('./data-source.js');

    expect(dataSource.options.entities).toHaveLength(9);
    expect(dataSource.options.migrations).toHaveLength(6);
    expect(dataSource.options.synchronize).toBe(false);
    await expect(dataSource.buildMetadatas()).resolves.toBeUndefined();

    const userMetadata = dataSource.entityMetadatas[0];
    expect(
      userMetadata.findColumnWithPropertyName('passwordHash')?.length,
    ).toBe('255');
    expect(userMetadata.findColumnWithPropertyName('createdAt')?.type).toBe(
      'timestamptz',
    );
    expect(userMetadata.findColumnWithPropertyName('updatedAt')?.type).toBe(
      'timestamptz',
    );
    expect(
      dataSource.entityMetadatas.map(({ tableName }) => tableName),
    ).toContain('article_favorites');

    const articleMetadata = dataSource.entityMetadatas.find(
      ({ tableName }) => tableName === 'articles',
    );
    expect(
      articleMetadata?.columns.map(({ databaseName }) => databaseName),
    ).toEqual(
      expect.arrayContaining([
        'id',
        'slug',
        'title',
        'description',
        'body',
        'author_id',
        'created_at',
        'updated_at',
      ]),
    );
    expect(articleMetadata?.indices.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'uq_articles_slug',
        'idx_articles_created_id',
        'idx_articles_author_created_id',
      ]),
    );

    const articleTagMetadata = dataSource.entityMetadatas.find(
      ({ tableName }) => tableName === 'article_tags',
    );
    expect(
      articleTagMetadata?.primaryColumns.map(
        ({ databaseName }) => databaseName,
      ),
    ).toEqual(['article_id', 'tag_id']);
    expect(articleTagMetadata?.foreignKeys.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'fk_article_tags_article',
        'fk_article_tags_tag',
      ]),
    );
    expect(articleTagMetadata?.checks.map(({ name }) => name)).toContain(
      'chk_article_tags_position_nonnegative',
    );

    const favoriteMetadata = dataSource.entityMetadatas.find(
      ({ tableName }) => tableName === 'article_favorites',
    );
    expect(
      favoriteMetadata?.primaryColumns.map(({ databaseName }) => databaseName),
    ).toEqual(['article_id', 'user_id']);
    expect(favoriteMetadata?.foreignKeys.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'fk_article_favorites_article',
        'fk_article_favorites_user',
      ]),
    );

    const commentMetadata = dataSource.entityMetadatas.find(
      ({ tableName }) => tableName === 'comments',
    );
    expect(
      commentMetadata?.columns.map(({ databaseName, type }) => ({
        databaseName,
        type,
      })),
    ).toEqual(
      expect.arrayContaining([
        { databaseName: 'id', type: 'integer' },
        { databaseName: 'body', type: 'text' },
        { databaseName: 'article_id', type: 'uuid' },
        { databaseName: 'author_id', type: 'uuid' },
        { databaseName: 'created_at', type: 'timestamptz' },
        { databaseName: 'updated_at', type: 'timestamptz' },
      ]),
    );
    expect(commentMetadata?.indices.map(({ name }) => name)).toContain(
      'idx_comments_article_created_id',
    );
    expect(
      commentMetadata?.foreignKeys.map(({ name, onDelete }) => ({
        name,
        onDelete,
      })),
    ).toEqual(
      expect.arrayContaining([
        { name: 'fk_comments_article', onDelete: 'CASCADE' },
        { name: 'fk_comments_author', onDelete: 'CASCADE' },
      ]),
    );
  });
});
