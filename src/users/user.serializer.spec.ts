import { describe, expect, it } from 'vitest';
import { serializeUser } from './user.serializer.js';

describe('serializeUser', () => {
  it('returns the RealWorld user representation without the password hash', () => {
    const user = {
      bio: null,
      email: 'reader@example.com',
      image: null,
      passwordHash: 'must-never-leak',
      username: 'reader',
    };
    const result = serializeUser(user, 'signed-token');

    expect(result).toEqual({
      user: {
        bio: null,
        email: 'reader@example.com',
        image: null,
        token: 'signed-token',
        username: 'reader',
      },
    });
    expect(result).not.toHaveProperty('user.passwordHash');
  });
});
