import { describe, expect, it, vi } from 'vitest';

import { UserService } from './user.service.js';

describe('UserService', () => {
  it('finds a user by username through the shared repository', async () => {
    const user = { username: 'jane' } as never;
    const findOneBy = vi.fn().mockResolvedValue(user);
    const service = new UserService({ findOneBy });

    await expect(service.findByUsername('jane')).resolves.toBe(user);
    expect(findOneBy).toHaveBeenCalledWith({ username: 'jane' });
  });
});
