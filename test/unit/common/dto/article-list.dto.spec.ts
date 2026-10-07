import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ArticleListQueryDto } from '../../../../src/common/dto/article.dto.js';

describe('ArticleListQueryDto', () => {
  it('defaults omitted pagination and converts valid query strings', async () => {
    const defaults = plainToInstance(ArticleListQueryDto, {});
    expect(defaults.offset).toBe(0);
    expect(defaults.limit).toBe(20);
    expect(await validate(defaults)).toEqual([]);

    const boundary = plainToInstance(ArticleListQueryDto, {
      tag: 'news',
      author: 'writer',
      favorited: 'reader',
      offset: '0',
      limit: '100',
    });
    expect(boundary.offset).toBe(0);
    expect(boundary.limit).toBe(100);
    expect(
      await validate(boundary, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([]);
  });

  it.each([
    ['offset', ''],
    ['offset', 'abc'],
    ['offset', '1.5'],
    ['offset', '-1'],
    ['offset', '9007199254740992'],
    ['limit', ''],
    ['limit', 'abc'],
    ['limit', '1.5'],
    ['limit', '-1'],
    ['limit', '0'],
    ['limit', '101'],
    ['limit', '9007199254740992'],
  ])('rejects invalid %s=%s', async (key, value) => {
    const dto = plainToInstance(ArticleListQueryDto, { [key]: value });
    expect(await validate(dto)).not.toEqual([]);
  });

  it('rejects undocumented query keys', async () => {
    const dto = plainToInstance(ArticleListQueryDto, {
      search: 'not-supported',
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).not.toEqual([]);
  });

  it('keeps inherited pagination defaults and bounds valid for the global list', async () => {
    const dto = plainToInstance(ArticleListQueryDto, {
      offset: '0',
      limit: '100',
    });
    expect(dto.offset).toBe(0);
    expect(dto.limit).toBe(100);
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([]);
  });
});
