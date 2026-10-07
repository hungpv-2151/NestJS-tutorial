import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';

import { AuthUpdateUserHandler } from '../../../src/auth/auth-update-user-handler.js';

describe('AuthUpdateUserHandler', () => {
  it('reissues a token for the same user before persisting profile updates', async () => {
    const signAsync = vi.fn().mockResolvedValue('replacement-token');
    const updateCurrentUser = vi.fn().mockResolvedValue({
      bio: null,
      email: 'jane@example.com',
      image: null,
      username: 'jane',
    });
    const handler = new AuthUpdateUserHandler(
      { updateCurrentUser } as never,
      { signAsync } as unknown as JwtService,
      { audience: 'web', issuer: 'api', secret: 'secret' },
    );

    await expect(
      handler.execute({ auth: { sub: 'jane' } } as never, {
        bio: 'Updated bio',
      }),
    ).resolves.toEqual({
      user: {
        bio: null,
        email: 'jane@example.com',
        image: null,
        token: 'replacement-token',
        username: 'jane',
      },
    });

    expect(signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ aud: 'web', iss: 'api', sub: 'jane' }),
    );
    expect(updateCurrentUser).toHaveBeenCalledWith('jane', {
      bio: 'Updated bio',
    });
    expect(signAsync.mock.invocationCallOrder[0]).toBeLessThan(
      updateCurrentUser.mock.invocationCallOrder[0],
    );
  });
});
