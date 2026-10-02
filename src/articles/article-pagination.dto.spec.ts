import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ArticlePaginationDto } from './article-pagination.dto.js';

describe('ArticlePaginationDto', () => {
  it('defaults omitted pagination and accepts integer boundaries', async () => {
    const defaults = plainToInstance(ArticlePaginationDto, {});
    expect(defaults).toMatchObject({ offset: 0, limit: 20 });
    expect(await validate(defaults, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);

    const boundary = plainToInstance(ArticlePaginationDto, { offset: '0', limit: '100' });
    expect(boundary).toMatchObject({ offset: 0, limit: 100 });
    expect(await validate(boundary, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
  });

  it.each([
    ['offset', ''], ['offset', 'abc'], ['offset', '1.5'], ['offset', '-1'],
    ['offset', '9007199254740992'], ['limit', ''], ['limit', 'abc'],
    ['limit', '1.5'], ['limit', '-1'], ['limit', '0'], ['limit', '101'],
    ['limit', '9007199254740992'],
  ])('rejects invalid %s=%s', async (key, value) => {
    const dto = plainToInstance(ArticlePaginationDto, { [key]: value });
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).not.toEqual([]);
  });

  it('rejects filters and unknown keys on the feed DTO', async () => {
    const dto = plainToInstance(ArticlePaginationDto, { author: 'ignored', search: 'ignored' });
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).not.toEqual([]);
  });
});
