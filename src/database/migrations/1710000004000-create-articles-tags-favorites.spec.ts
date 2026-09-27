import { describe, expect, it, vi } from 'vitest';
import { CreateArticlesTagsFavorites1710000004000 } from './1710000004000-create-articles-tags-favorites.js';
import type { QueryRunner } from 'typeorm';

describe('CreateArticlesTagsFavorites1710000004000', () => {
  it('creates constrained tables and indexes in dependency order', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateArticlesTagsFavorites1710000004000();

    await migration.up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([statement]) => statement as string);
    expect(sql[0]).toContain('CREATE TABLE "articles"');
    expect(sql[0]).toContain('CONSTRAINT "uq_articles_slug" UNIQUE');
    expect(sql[0]).toContain('CONSTRAINT "fk_articles_author" FOREIGN KEY');
    expect(sql[0]).toContain('REFERENCES "users"("id") ON DELETE CASCADE');
    expect(sql[1]).toContain('CONSTRAINT "uq_tags_name" UNIQUE');
    expect(sql[2]).toContain(
      'CONSTRAINT "chk_article_tags_position_nonnegative"',
    );
    expect(sql[2]).toContain(
      'CONSTRAINT "uq_article_tags_article_position" UNIQUE',
    );
    expect(sql[2]).toContain(
      'CONSTRAINT "fk_article_tags_article" FOREIGN KEY',
    );
    expect(sql[2]).toContain('CONSTRAINT "fk_article_tags_tag" FOREIGN KEY');
    expect(sql[3]).toContain('CONSTRAINT "pk_article_favorites" PRIMARY KEY');
    expect(sql[3]).toContain(
      'CONSTRAINT "fk_article_favorites_article" FOREIGN KEY',
    );
    expect(sql[3]).toContain(
      'CONSTRAINT "fk_article_favorites_user" FOREIGN KEY',
    );
    expect(sql[4]).toContain('idx_articles_created_id');
  });

  it('drops dependent tables before their parents', async () => {
    const query = vi.fn().mockResolvedValue(undefined);

    await new CreateArticlesTagsFavorites1710000004000().down({
      query,
    } as unknown as QueryRunner);

    expect(query.mock.calls.map(([statement]) => statement)).toEqual([
      'DROP TABLE IF EXISTS "article_favorites"',
      'DROP TABLE IF EXISTS "article_tags"',
      'DROP TABLE IF EXISTS "tags"',
      'DROP TABLE IF EXISTS "articles"',
    ]);
  });
});
