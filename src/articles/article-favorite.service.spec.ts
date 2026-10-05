import { describe, expect, it } from 'vitest';

import {
  ArticleFavoriteCreateArticleNotFoundError,
  ArticleFavoriteCreatePersistenceError,
  ArticleFavoriteCreateUserNotFoundError,
} from './article-favorite.service.js';

describe('ArticleFavoriteService errors', () => {
  it.each([
    [
      new ArticleFavoriteCreateUserNotFoundError(),
      401,
      { token: ['is invalid'] },
    ],
    [
      new ArticleFavoriteCreateArticleNotFoundError(),
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
