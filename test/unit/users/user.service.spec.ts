import { describe, expect, it, vi } from 'vitest';

import { UserService } from '../../../src/users/user.service.js';

describe('UserService', () => {
  it('finds a user by username through the shared repository', async () => {
    const user = { username: 'jane' } as never;
    const findOneBy = vi.fn().mockResolvedValue(user);
    const service = new UserService({ findOneBy, save: vi.fn() });

    await expect(service.findByUsername('jane')).resolves.toBe(user);
    expect(findOneBy).toHaveBeenCalledWith({ username: 'jane' });
  });

  it('updates profile fields without changing login credentials', async () => {
    const user = createUser();
    const findOneBy = vi.fn().mockResolvedValue(user);
    const save = vi.fn().mockResolvedValue(user);
    const service = new UserService({ findOneBy, save });

    await expect(
      service.updateCurrentUser('jane', {
        bio: null,
        image: 'https://example.com/new.jpg',
      }),
    ).resolves.toBe(user);

    expect(user.bio).toBeNull();
    expect(user.image).toBe('https://example.com/new.jpg');
    expect(user.email).toBe('jane@example.com');
    expect(user.username).toBe('jane');
    expect(user.passwordHash).toBe('old-hash');
    expect(save).toHaveBeenCalledWith(user);
    expect(findOneBy).toHaveBeenCalledTimes(1);
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
