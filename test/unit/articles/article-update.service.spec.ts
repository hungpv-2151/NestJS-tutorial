import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import {
  ArticleUpdateRequestDto,
  ArticleUpdateDto,
} from '../../../src/common/dto/article-update.dto.js';
import {
  ArticleUpdateArticleNotFoundError,
  ArticleUpdateForbiddenError,
  ArticleUpdatePersistenceError,
  ArticleUpdateUserNotFoundError,
} from '../../../src/articles/article-update.service.js';

describe('ArticleUpdateRequestDto', () => {
  it.each([
    ['empty update', { article: {} }],
    ['partial scalar update', { article: { body: 'New body' } }],
    ['ordered tag replacement', { article: { tagList: ['first', 'second'] } }],
  ])('accepts %s', async (_label, payload) => {
    const errors = await validate(
      plainToInstance(ArticleUpdateRequestDto, payload),
    );

    expect(errors).toEqual([]);
  });

  it.each([
    ['null tagList', { article: { tagList: null } }],
    ['wrong scalar type', { article: { body: 42 } }],
    ['wrong tag item type', { article: { tagList: ['valid', 42] } }],
    ['blank tag name', { article: { tagList: ['   '] } }],
    ['unknown article field', { article: { authorId: 'attacker-id' } }],
    ['missing article envelope', {}],
  ])('rejects %s', async (_label, payload) => {
    const errors = await validate(
      plainToInstance(ArticleUpdateRequestDto, payload),
      { forbidNonWhitelisted: true, whitelist: true },
    );

    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('ArticleUpdateDto', () => {
  it('keeps every patch field optional', () => {
    const empty = plainToInstance(ArticleUpdateDto, {});

    expect(empty).toEqual({});
  });
});

describe('ArticleUpdateService errors', () => {
  it.each([
    [new ArticleUpdateUserNotFoundError(), 401, { token: ['is invalid'] }],
    [new ArticleUpdateArticleNotFoundError(), 404, { article: ['not found'] }],
    [new ArticleUpdateForbiddenError(), 403, { article: ['forbidden'] }],
    [
      new ArticleUpdatePersistenceError(new Error('database failed')),
      500,
      { body: ['request failed'] },
    ],
  ])(
    'exposes the HTTP response for service errors',
    (error, status, errors) => {
      expect(error.getStatus()).toBe(status);
      expect(error.getResponse()).toEqual({ errors });
    },
  );
});
