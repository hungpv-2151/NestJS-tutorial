import { describe, expect, it } from 'vitest';

import {
  ArticleFavoriteArticleNotFoundError,
  ArticleFavoriteCreatePersistenceError,
  ArticleFavoriteUserNotFoundError,
} from './article-favorite.service.js';

describe('ArticleFavoriteService errors', () => {
  it.each([
    [new ArticleFavoriteUserNotFoundError(), 401, { token: ['is invalid'] }],
    [
      new ArticleFavoriteArticleNotFoundError(),
      404,
      { article: ['not found'] },
    ],
    [
      new ArticleFavoriteCreatePersistenceError(new Error('private failure')),
      500,
      { body: ['request failed'] },
    ],
  ])('exposes the HTTP response for create errors', (error, status, errors) => {
    expect(error.getStatus()).toBe(status);
    expect(error.getResponse()).toEqual({ errors });
  });
});
