import { describe, expect, it } from 'vitest';

import { serializeComment } from './comment.serializer.js';

describe('serializeComment', () => {
  it('returns only the comment contract and public author profile fields', () => {
    const createdAt = new Date('2026-09-29T10:00:00.000Z');
    const updatedAt = new Date('2026-09-29T10:05:00.000Z');
    const author = {
      bio: 'Reader',
      email: 'reader@example.com',
      id: 'user-secret-id',
      image: 'https://example.com/reader.png',
      passwordHash: 'never-return-this',
      username: 'reader',
    };

    expect(
      serializeComment({
        id: 42,
        body: 'A useful comment',
        createdAt,
        updatedAt,
        author,
      }),
    ).toEqual({
      id: 42,
      body: 'A useful comment',
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      author: {
        bio: 'Reader',
        following: false,
        image: 'https://example.com/reader.png',
        username: 'reader',
      },
    });
  });

  it('uses the supplied author following state', () => {
    const serialized = serializeComment(
      {
        id: 1,
        body: 'Following state',
        createdAt: new Date('2026-09-29T10:00:00.000Z'),
        updatedAt: new Date('2026-09-29T10:00:00.000Z'),
        author: { bio: null, image: null, username: 'reader' },
      },
      true,
    );

    expect(serialized.author.following).toBe(true);
  });
});
