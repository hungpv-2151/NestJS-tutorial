import { describe, expect, it, vi } from 'vitest';

import { ProfileService } from './profile.service.js';

describe('ProfileService', () => {
  it('unfollows idempotently with the exact follow composite key', async () => {
    const deleteFollow = vi.fn().mockResolvedValue({ affected: 1 });
    const service = new ProfileService(
      {
        findByUsername: vi
          .fn()
          .mockResolvedValueOnce({ id: 'john-id' })
          .mockResolvedValueOnce({ id: 'jane-id', username: 'jane' })
          .mockResolvedValueOnce({ id: 'john-id' })
          .mockResolvedValueOnce({ id: 'jane-id', username: 'jane' }),
      } as never,
      { delete: deleteFollow } as never,
    );

    await service.unfollow('john', 'jane');
    await service.unfollow('john', 'jane');

    expect(deleteFollow).toHaveBeenCalledTimes(2);
    expect(deleteFollow).toHaveBeenCalledWith({
      followerId: 'john-id',
      followingId: 'jane-id',
    });
  });
});
