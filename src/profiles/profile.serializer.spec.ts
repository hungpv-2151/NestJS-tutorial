import { describe, expect, it } from 'vitest';

import { serializeProfile } from './profile.serializer.js';

describe('serializeProfile', () => {
  it('returns only public profile fields', () => {
    expect(
      serializeProfile({
        bio: 'About Jane',
        email: 'jane@example.com',
        image: 'https://example.com/jane.jpg',
        passwordHash: 'secret',
        username: 'jane',
      } as never),
    ).toEqual({
      profile: {
        bio: 'About Jane',
        following: false,
        image: 'https://example.com/jane.jpg',
        username: 'jane',
      },
    });
  });
});
