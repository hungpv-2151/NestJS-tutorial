import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';

import { AuthUpdateUserHandler } from './auth-update-user-handler.js';

describe('AuthUpdateUserHandler', () => {
  it('issues a token for the replacement username before persisting it', async () => {
    const signAsync = vi.fn().mockResolvedValue('replacement-token');
    const updateCurrentUser = vi.fn().mockResolvedValue({
      bio: null,
      email: 'jane@example.com',
      image: null,
      username: 'janet',
    });
    const handler = new AuthUpdateUserHandler(
      { updateCurrentUser } as never,
      { signAsync } as unknown as JwtService,
      { audience: 'web', issuer: 'api', secret: 'secret' },
    );

    await expect(
      handler.execute({ auth: { sub: 'jane' } } as never, {
        username: 'janet',
      }),
    ).resolves.toEqual({
      user: {
        bio: null,
        email: 'jane@example.com',
        image: null,
        token: 'replacement-token',
        username: 'janet',
      },
    });

    expect(signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ aud: 'web', iss: 'api', sub: 'janet' }),
    );
    expect(updateCurrentUser).toHaveBeenCalledWith('jane', {
      username: 'janet',
    });
    expect(signAsync.mock.invocationCallOrder[0]).toBeLessThan(
      updateCurrentUser.mock.invocationCallOrder[0],
    );
  });
});
