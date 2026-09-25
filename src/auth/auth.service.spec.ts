import { hash, verify } from 'argon2';
import { describe, expect, it, vi } from 'vitest';

import { User } from '../users/user.entity.js';
import { WelcomeMailOutbox } from '../jobs/welcome-mail-outbox.entity.js';
import type {
  AuthLoginRateLimiterPort,
  AuthLoginTokenIssuer,
} from './auth-login-contracts.js';
import { AuthLoginRateLimitError } from './auth-login-rate-limiter.js';
import {
  AuthConflictError,
  AuthInvalidCredentialsError,
  AuthInvalidTokenError,
  AuthPersistenceError,
  AuthService,
  type AuthLoginRepository,
  type AuthPasswordVerifier,
  type UserRepository,
  type WelcomeMailOutboxRepository,
} from './auth.service.js';

class TransactionRolledBackError extends Error {
  constructor(cause: Error) {
    super('transaction rolled back', { cause });
  }
}

class DuplicateDatabaseError extends Error {
  readonly code = '23505';

  constructor(
    readonly detail: string,
    readonly constraint?: string,
  ) {
    super('duplicate key value violates unique constraint');
  }
}

class FakeRepository implements UserRepository {
  readonly savedUsers: User[] = [];
  saveError?: Error;

  async findOneBy(
    criteria: Partial<Pick<User, 'email' | 'username'>>,
  ): Promise<User | null> {
    return (
      this.savedUsers.find(
        (user) =>
          (criteria.username !== undefined &&
            user.username === criteria.username) ||
          (criteria.email !== undefined && user.email === criteria.email),
      ) ?? null
    );
  }

  create(user: Pick<User, 'email' | 'passwordHash' | 'username'>): User {
    return { ...user, id: 'user-id' } as User;
  }

  async save(user: User): Promise<User> {
    if (this.saveError) {
      throw this.saveError;
    }
    this.savedUsers.push(user);
    return user;
  }
}

class FakeOutboxRepository implements WelcomeMailOutboxRepository {
  readonly savedOutbox: WelcomeMailOutbox[] = [];
  saveError?: Error;

  create(
    outbox: Pick<WelcomeMailOutbox, 'email' | 'userId' | 'username'>,
  ): WelcomeMailOutbox {
    return { ...outbox } as WelcomeMailOutbox;
  }

  async save(outbox: WelcomeMailOutbox): Promise<WelcomeMailOutbox> {
    if (this.saveError) {
      throw this.saveError;
    }
    this.savedOutbox.push(outbox);
    return outbox;
  }
}

function createService(
  repository = new FakeRepository(),
  outboxRepository = new FakeOutboxRepository(),
) {
  let isRolledBack = false;
  const service = new AuthService(
    {
      transaction: async (work) => {
      const userSnapshot = [...repository.savedUsers];
      const outboxSnapshot = [...outboxRepository.savedOutbox];
      try {
        return await work({
          getRepository: (entity: typeof User | typeof WelcomeMailOutbox) =>
            entity === User ? repository : outboxRepository,
        } as never);
      } catch (error) {
        repository.savedUsers.splice(
          0,
          repository.savedUsers.length,
          ...userSnapshot,
        );
        outboxRepository.savedOutbox.splice(
          0,
          outboxRepository.savedOutbox.length,
          ...outboxSnapshot,
        );
        isRolledBack = true;
        if (error instanceof AuthConflictError) {
          throw new AuthConflictError(error.field);
        }
        if (error instanceof DuplicateDatabaseError) {
          throw new DuplicateDatabaseError(error.detail, error.constraint);
        }
        throw new TransactionRolledBackError(error as Error);
      }
      },
    },
    { findByEmail: async () => null },
    { consume: async () => undefined },
    { issue: async () => 'signed-token' },
  );
  return { outboxRepository, repository, rolledBack: () => isRolledBack, service };
}

describe('AuthService', () => {
  it('verifies token claims and normalizes verification failures', async () => {
    const claims = {
      aud: 'client',
      exp: 1900,
      iat: 1000,
      iss: 'api',
      jti: 'token-id',
      sub: 'jane',
    };
    const service = new AuthService(
      { transaction: async (work) => work({} as never) },
      { findByEmail: async () => null },
      { consume: async () => undefined },
      { issue: async () => 'signed-token' },
      undefined,
      { verify: async () => claims },
    );
    await expect(service.authenticate('signed-token')).resolves.toEqual(claims);

    const rejected = new AuthService(
      { transaction: async (work) => work({} as never) },
      { findByEmail: async () => null },
      { consume: async () => undefined },
      { issue: async () => 'signed-token' },
      undefined,
      { verify: async () => Promise.reject(new Error('invalid signature')) },
    );
    await expect(rejected.authenticate('invalid-token')).rejects.toBeInstanceOf(
      AuthInvalidTokenError,
    );
  });

  it('finds the current user in the service and rejects a missing user', async () => {
    const user = { email: 'jane@example.com', username: 'jane' } as User;
    const findByUsername = vi.fn().mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    const service = new AuthService(
      { transaction: async (work) => work({} as never) },
      { findByEmail: async () => null },
      { consume: async () => undefined },
      { issue: async () => 'signed-token' },
      undefined,
      undefined,
      { findByUsername },
    );
    await expect(service.currentUser('jane')).resolves.toBe(user);
    await expect(service.currentUser('deleted')).rejects.toBeInstanceOf(AuthInvalidTokenError);
    expect(findByUsername).toHaveBeenNthCalledWith(1, 'jane');
  });

  it('rate limits, validates credentials, and issues a token during login', async () => {
    const user = await userWithPassword('safe-password');
    const loginRateLimiter = { consume: vi.fn().mockResolvedValue(undefined) };
    const tokenIssuer = { issue: vi.fn().mockResolvedValue('signed-token') };
    const service = createLoginService(
      { findByEmail: async () => user },
      loginRateLimiter,
      tokenIssuer,
    );

    await expect(
      service.login({
        email: user.email,
        ipAddress: '127.0.0.1',
        password: 'safe-password',
      }),
    ).resolves.toEqual({ token: 'signed-token', user });

    expect(loginRateLimiter.consume).toHaveBeenCalledWith(
      user.email,
      '127.0.0.1',
    );
    expect(tokenIssuer.issue).toHaveBeenCalledWith(user.username);
  });

  it('rejects an unknown email or incorrect password with one error', async () => {
    const user = await userWithPassword('different-password');
    const unknownEmail = createLoginService({ findByEmail: async () => null });
    const wrongPassword = createLoginService({ findByEmail: async () => user });

    await expect(
      unknownEmail.login({
        email: 'missing@example.com',
        ipAddress: '127.0.0.1',
        password: 'safe-password',
      }),
    ).rejects.toBeInstanceOf(AuthInvalidCredentialsError);
    await expect(
      wrongPassword.login({
        email: user.email,
        ipAddress: '127.0.0.1',
        password: 'safe-password',
      }),
    ).rejects.toBeInstanceOf(AuthInvalidCredentialsError);
  });

  it('stops before credential lookup when login is rate limited', async () => {
    const findByEmail = vi.fn();
    const loginRateLimiter = {
      consume: vi.fn().mockRejectedValue(new AuthLoginRateLimitError()),
    };
    const service = createLoginService({ findByEmail }, loginRateLimiter);

    await expect(
      service.login({
        email: 'jane@example.com',
        ipAddress: '127.0.0.1',
        password: 'safe-password',
      }),
    ).rejects.toBeInstanceOf(AuthLoginRateLimitError);
    expect(findByEmail).not.toHaveBeenCalled();
  });

  it('propagates token signing failures after valid credentials', async () => {
    const user = await userWithPassword('safe-password');
    const signingError = new Error('signer unavailable');
    const tokenIssuer = {
      issue: vi.fn().mockRejectedValue(signingError),
    };
    const service = createLoginService(
      { findByEmail: async () => user },
      undefined,
      tokenIssuer,
    );

    await expect(
      service.login({
        email: user.email,
        ipAddress: '127.0.0.1',
        password: 'safe-password',
      }),
    ).rejects.toBe(signingError);
  });

  it('verifies a password hash when an email is unknown', async () => {
    const matches = vi.fn().mockResolvedValue(false);
    const service = createLoginService(
      { findByEmail: async () => null },
      undefined,
      undefined,
      { matches },
    );

    await expect(
      service.login({
        email: 'missing@example.com',
        ipAddress: '127.0.0.1',
        password: 'safe-password',
      }),
    ).rejects.toBeInstanceOf(AuthInvalidCredentialsError);

    expect(matches).toHaveBeenCalledWith(
      expect.stringMatching(/^\$argon2id\$/),
      'safe-password',
    );
  });

  it('hashes password and persists a user without returning the hash', async () => {
    const { outboxRepository, repository, service } = createService();

    const user = await service.register({
      email: 'jane@example.com',
      password: 'safe-password',
      username: 'jane',
    });

    expect(user).toEqual({ email: 'jane@example.com', username: 'jane' });
    expect(
      await verify(repository.savedUsers[0].passwordHash, 'safe-password'),
    ).toBe(true);
    expect(outboxRepository.savedOutbox).toEqual([
      { email: 'jane@example.com', userId: 'user-id', username: 'jane' },
    ]);
  });

  it.each([
    [
      'username',
      {
        email: 'other@example.com',
        password: 'safe-password',
        username: 'jane',
      },
    ],
    [
      'email',
      {
        email: 'jane@example.com',
        password: 'safe-password',
        username: 'other',
      },
    ],
  ])('rejects duplicate %s without saving changes', async (field, request) => {
    const { repository, rolledBack, service } = createService();
    repository.savedUsers.push({
      email: 'jane@example.com',
      username: 'jane',
    } as User);

    await expect(service.register(request)).rejects.toMatchObject({ field });
    await expect(service.register(request)).rejects.toBeInstanceOf(
      AuthConflictError,
    );
    expect(repository.savedUsers).toHaveLength(1);
    expect(rolledBack()).toBe(true);
  });

  it('rolls back when persistence fails', async () => {
    const repository = new FakeRepository();
    repository.saveError = new Error('database unavailable');
    const { rolledBack, service } = createService(repository);

    await expect(
      service.register({
        email: 'jane@example.com',
        password: 'safe-password',
        username: 'jane',
      }),
    ).rejects.toBeInstanceOf(AuthPersistenceError);

    expect(repository.savedUsers).toEqual([]);
    expect(rolledBack()).toBe(true);
  });

  it('rolls back the user when outbox persistence fails', async () => {
    const outboxRepository = new FakeOutboxRepository();
    outboxRepository.saveError = new Error('outbox unavailable');
    const { repository, rolledBack, service } = createService(
      new FakeRepository(),
      outboxRepository,
    );

    await expect(
      service.register({
        email: 'jane@example.com',
        password: 'safe-password',
        username: 'jane',
      }),
    ).rejects.toBeInstanceOf(AuthPersistenceError);

    expect(repository.savedUsers).toEqual([]);
    expect(outboxRepository.savedOutbox).toEqual([]);
    expect(rolledBack()).toBe(true);
  });

  it.each(['username', 'email'] as const)(
    'maps a database duplicate for %s without leaking database details',
    async (field) => {
      const repository = new FakeRepository();
      repository.saveError = new DuplicateDatabaseError(
        `Key (${field})=(jane) already exists.`,
      );
      const { rolledBack, service } = createService(repository);

      const error = await service
        .register({
          email: 'jane@example.com',
          password: 'safe-password',
          username: 'jane',
        })
        .catch((caught: unknown) => caught);

      expect(error).toMatchObject({ field });
      expect(error).toBeInstanceOf(AuthConflictError);
      expect(error).not.toHaveProperty('detail');
      expect(rolledBack()).toBe(true);
    },
  );

  it('maps an email duplicate when its value contains username', async () => {
    const repository = new FakeRepository();
    repository.saveError = new DuplicateDatabaseError(
      'Key (email)=(username@example.com) already exists.',
    );
    const { service } = createService(repository);

    await expect(
      service.register({
        email: 'username@example.com',
        password: 'safe-password',
        username: 'jane',
      }),
    ).rejects.toMatchObject({ field: 'email' });
  });

  it('maps a database duplicate by constraint name', async () => {
    const repository = new FakeRepository();
    repository.saveError = new DuplicateDatabaseError('', 'users_username_key');
    const { service } = createService(repository);

    await expect(
      service.register({
        email: 'jane@example.com',
        password: 'safe-password',
        username: 'jane',
      }),
    ).rejects.toMatchObject({ field: 'username' });
  });

  it('uses a generic conflict when a database constraint is unknown', async () => {
    const repository = new FakeRepository();
    repository.saveError = new DuplicateDatabaseError('', 'users_unexpected_key');
    const { service } = createService(repository);

    await expect(
      service.register({
        email: 'jane@example.com',
        password: 'safe-password',
        username: 'jane',
      }),
    ).rejects.toMatchObject({ field: 'body' });
  });
});

async function userWithPassword(password: string): Promise<User> {
  return {
    bio: null,
    email: 'jane@example.com',
    image: null,
    passwordHash: await hash(password),
    username: 'jane',
  } as User;
}

function createLoginService(
  loginRepository: AuthLoginRepository,
  loginRateLimiter: AuthLoginRateLimiterPort = {
    consume: async () => undefined,
  },
  tokenIssuer: AuthLoginTokenIssuer = {
    issue: async () => 'signed-token',
  },
  passwordVerifier?: AuthPasswordVerifier,
): AuthService {
  return new AuthService(
    { transaction: async (work) => work({} as never) },
    loginRepository,
    loginRateLimiter,
    tokenIssuer,
    passwordVerifier,
  );
}
