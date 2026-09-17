import { verify } from 'argon2';
import { describe, expect, it } from 'vitest';

import { User } from './user.entity.js';
import {
  UserRegistrationConflictError,
  UserRegistrationPersistenceError,
  UserRegistrationService,
  type UserRegistrationRepository,
} from './user-registration.service.js';

class TransactionRolledBackError extends Error {
  constructor(cause: Error) {
    super('transaction rolled back', { cause });
  }
}

class DuplicateDatabaseError extends Error {
  readonly code = '23505';

  constructor(readonly detail: string) {
    super('duplicate key value violates unique constraint');
  }
}

class FakeRepository implements UserRegistrationRepository {
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
    return { ...user } as User;
  }

  async save(user: User): Promise<User> {
    if (this.saveError) {
      throw this.saveError;
    }
    this.savedUsers.push(user);
    return user;
  }
}

function createService(repository = new FakeRepository()) {
  let isRolledBack = false;
  const service = new UserRegistrationService({
    transaction: async (work) => {
      const snapshot = [...repository.savedUsers];
      try {
        return await work({ getRepository: () => repository });
      } catch (error) {
        repository.savedUsers.splice(
          0,
          repository.savedUsers.length,
          ...snapshot,
        );
        isRolledBack = true;
        if (error instanceof UserRegistrationConflictError) {
          throw new UserRegistrationConflictError(error.field);
        }
        if (error instanceof DuplicateDatabaseError) {
          throw new DuplicateDatabaseError(error.detail);
        }
        throw new TransactionRolledBackError(error as Error);
      }
    },
  });
  return { repository, rolledBack: () => isRolledBack, service };
}

describe('UserRegistrationService', () => {
  it('hashes password and persists a user without returning the hash', async () => {
    const { repository, service } = createService();

    const user = await service.register({
      email: 'jane@example.com',
      password: 'safe-password',
      username: 'jane',
    });

    expect(user).toEqual({ email: 'jane@example.com', username: 'jane' });
    expect(
      await verify(repository.savedUsers[0].passwordHash, 'safe-password'),
    ).toBe(true);
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
      UserRegistrationConflictError,
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
    ).rejects.toBeInstanceOf(UserRegistrationPersistenceError);

    expect(repository.savedUsers).toEqual([]);
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
      expect(error).toBeInstanceOf(UserRegistrationConflictError);
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
});
