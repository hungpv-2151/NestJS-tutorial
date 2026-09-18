import { hash, verify } from 'argon2';
import { describe, expect, it, vi } from 'vitest';

import { User } from '../users/user.entity.js';
import { WelcomeMailOutbox } from '../jobs/welcome-mail-outbox.entity.js';
import {
  AuthConflictError,
  AuthInvalidCredentialsError,
  AuthInvalidTokenError,
  AuthPersistenceError,
  AuthService,
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
          getRepository: (entity) =>
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
  );
  return { outboxRepository, repository, rolledBack: () => isRolledBack, service };
}

describe('AuthService', () => {
  it('returns verified token claims and hides verification failures', async () => {
    const claims = {
      aud: 'client',
      exp: 1_900,
      iat: 1_000,
      iss: 'api',
      jti: 'token-id',
      sub: 'jane',
    };
    const authenticated = new AuthService(
      { transaction: async (work) => work({} as never) },
      { findByEmail: async () => null },
      undefined,
      { verify: async () => claims },
    );
    const rejected = new AuthService(
      { transaction: async (work) => work({} as never) },
      { findByEmail: async () => null },
      undefined,
      { verify: async () => Promise.reject(new Error('invalid signature')) },
    );

    await expect(authenticated.authenticate('signed-token')).resolves.toEqual(claims);
    await expect(rejected.authenticate('invalid-token')).rejects.toBeInstanceOf(
      AuthInvalidTokenError,
    );
  });

  it('logs in when the password matches', async () => {
    const user = await userWithPassword('safe-password');
    const service = new AuthService(
      { transaction: async (work) => work({} as never) },
      { findByEmail: async () => user },
    );

    await expect(service.login(user.email, 'safe-password')).resolves.toBe(user);
  });

  it('rejects an unknown email or incorrect password with one error', async () => {
    const user = await userWithPassword('different-password');
    const unknownEmail = new AuthService(
      { transaction: async (work) => work({} as never) },
      { findByEmail: async () => null },
    );
    const wrongPassword = new AuthService(
      { transaction: async (work) => work({} as never) },
      { findByEmail: async () => user },
    );

    await expect(
      unknownEmail.login('missing@example.com', 'safe-password'),
    ).rejects.toBeInstanceOf(AuthInvalidCredentialsError);
    await expect(
      wrongPassword.login(user.email, 'safe-password'),
    ).rejects.toBeInstanceOf(AuthInvalidCredentialsError);
  });

  it('verifies a password hash when an email is unknown', async () => {
    const matches = vi.fn().mockResolvedValue(false);
    const service = new AuthService(
      { transaction: async (work) => work({} as never) },
      { findByEmail: async () => null },
      { matches },
    );

    await expect(
      service.login('missing@example.com', 'safe-password'),
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
