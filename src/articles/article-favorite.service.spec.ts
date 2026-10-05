import { describe, expect, it } from 'vitest';

import {
  ArticleFavoriteArticleNotFoundError,
  ArticleFavoriteCreatePersistenceError,
  ArticleFavoriteDeletePersistenceError,
  ArticleFavoriteUserNotFoundError,
} from './article-favorite.service.js';

describe('ArticleFavoriteService errors', () => {
  it.each([
    [
      'create',
      new ArticleFavoriteUserNotFoundError(),
      401,
      { token: ['is invalid'] },
    ],
    [
      'create',
      new ArticleFavoriteArticleNotFoundError(),
      404,
      { article: ['not found'] },
    ],
    [
      'create',
      new ArticleFavoriteCreatePersistenceError(new Error('private failure')),
      500,
      { body: ['request failed'] },
    ],
    [
      'delete',
      new ArticleFavoriteUserNotFoundError(),
      401,
      { token: ['is invalid'] },
    ],
    [
      'delete',
      new ArticleFavoriteArticleNotFoundError(),
      404,
      { article: ['not found'] },
    ],
    [
      'delete',
      new ArticleFavoriteDeletePersistenceError(new Error('private failure')),
      500,
      { body: ['request failed'] },
    ],
  ])(
    'exposes the HTTP response for %s errors',
    (_operation, error, status, errors) => {
      expect(error.getStatus()).toBe(status);
      expect(error.getResponse()).toEqual({ errors });
    },
  );
});
