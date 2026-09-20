import * as argon2 from 'argon2';
import { describe, expect, it, vi } from 'vitest';

import { UserService, UserUpdateConflictError } from './user.service.js';

describe('UserService', () => {
  it('finds a user by username through the shared repository', async () => {
    const user = { username: 'jane' } as never;
    const findOneBy = vi.fn().mockResolvedValue(user);
    const service = new UserService({ findOneBy, save: vi.fn() });

    await expect(service.findByUsername('jane')).resolves.toBe(user);
    expect(findOneBy).toHaveBeenCalledWith({ username: 'jane' });
  });

  it('updates allowed fields and hashes a replacement password', async () => {
    const user = createUser();
    const findOneBy = vi
      .fn()
      .mockResolvedValueOnce(user)
      .mockResolvedValue(null);
    const save = vi.fn().mockResolvedValue(user);
    const service = new UserService({ findOneBy, save });

    await expect(
      service.updateCurrentUser('jane', {
        bio: null,
        password: 'replacement-password',
        username: 'janet',
      }),
    ).resolves.toBe(user);

    expect(user.bio).toBeNull();
    expect(user.username).toBe('janet');
    await expect(
      argon2.verify(user.passwordHash, 'replacement-password'),
    ).resolves.toBe(true);
    expect(save).toHaveBeenCalledWith(user);
  });

  it('rejects an email already used by another user', async () => {
    const findOneBy = vi
      .fn()
      .mockResolvedValueOnce(createUser())
      .mockResolvedValueOnce(createUser());
    const service = new UserService({ findOneBy, save: vi.fn() });

    await expect(
      service.updateCurrentUser('jane', { email: 'taken@example.com' }),
    ).rejects.toEqual(new UserUpdateConflictError('email'));
  });

  it('maps a concurrent unique-constraint failure to a conflict', async () => {
    const user = createUser();
    const findOneBy = vi.fn().mockResolvedValue(user);
    const save = vi
      .fn()
      .mockRejectedValue({ code: '23505', constraint: 'users_username_key' });
    const service = new UserService({ findOneBy, save });

    await expect(
      service.updateCurrentUser('jane', { username: 'janet' }),
    ).rejects.toEqual(new UserUpdateConflictError('username'));
  });
});

function createUser() {
  return {
    bio: 'About Jane',
    email: 'jane@example.com',
    id: 'user-id',
    image: 'https://example.com/jane.jpg',
    passwordHash: 'old-hash',
    username: 'jane',
  } as never;
}
