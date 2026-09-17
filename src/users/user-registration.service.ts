import * as argon2 from 'argon2';

import { WelcomeMailOutbox } from '../jobs/welcome-mail-outbox.entity.js';
import { User } from './user.entity.js';

const UNIQUE_VIOLATION_CODE = '23505';
const UNIQUE_CONSTRAINT_FIELDS = {
  users_email_key: 'email',
  users_username_key: 'username',
} as const;
type UserRegistrationConflictField = 'body' | 'email' | 'username';

export type UserRegistrationRequest = Pick<User, 'email' | 'username'> & {
  password: string;
};

export interface RegisteredUser {
  email: string;
  username: string;
}

export interface UserRegistrationRepository {
  create(user: Pick<User, 'email' | 'passwordHash' | 'username'>): User;
  findOneBy(
    criteria: Partial<Pick<User, 'email' | 'username'>>,
  ): Promise<User | null>;
  save(user: User): Promise<User>;
}

export interface WelcomeMailOutboxRepository {
  create(
    outbox: Pick<WelcomeMailOutbox, 'email' | 'userId' | 'username'>,
  ): WelcomeMailOutbox;
  save(outbox: WelcomeMailOutbox): Promise<WelcomeMailOutbox>;
}

export interface UserRegistrationTransactionManager {
  getRepository(entity: typeof User): UserRegistrationRepository;
  getRepository(entity: typeof WelcomeMailOutbox): WelcomeMailOutboxRepository;
}

export interface UserRegistrationTransaction {
  transaction<T>(
    work: (manager: UserRegistrationTransactionManager) => Promise<T>,
  ): Promise<T>;
}

export class UserRegistrationConflictError extends Error {
  constructor(readonly field: UserRegistrationConflictField) {
    super(`${field} has already been taken`);
  }
}

export class UserRegistrationPersistenceError extends Error {
  constructor(cause: unknown) {
    super('user registration could not be saved', { cause });
  }
}

export class UserRegistrationService {
  constructor(private readonly dataSource: UserRegistrationTransaction) {}

  async register(request: UserRegistrationRequest): Promise<RegisteredUser> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const userRepository = manager.getRepository(User);
        const outboxRepository = manager.getRepository(WelcomeMailOutbox);
        await this.assertAvailable(userRepository, 'username', request.username);
        await this.assertAvailable(userRepository, 'email', request.email);

        const passwordHash = await argon2.hash(request.password, {
          type: argon2.argon2id,
        });
        const user = await userRepository.save(
          userRepository.create({
            email: request.email,
            passwordHash,
            username: request.username,
          }),
        );
        await outboxRepository.save(
          outboxRepository.create({
            email: user.email,
            userId: user.id,
            username: user.username,
          }),
        );

        return { email: user.email, username: user.username };
      });
    } catch (error) {
      if (error instanceof UserRegistrationConflictError) {
        throw new UserRegistrationConflictError(error.field);
      }
      if (isUniqueViolation(error)) {
        throw new UserRegistrationConflictError(getDuplicateField(error) ?? 'body');
      }
      throw new UserRegistrationPersistenceError(error);
    }
  }

  private async assertAvailable(
    repository: UserRegistrationRepository,
    field: 'email' | 'username',
    value: string,
  ): Promise<void> {
    if (await repository.findOneBy({ [field]: value })) {
      throw new UserRegistrationConflictError(field);
    }
  }
}

function getDuplicateField(error: Record<string, unknown>):
  | 'email'
  | 'username'
  | undefined {
  const constraint = error.constraint;
  if (
    typeof constraint === 'string' &&
    constraint in UNIQUE_CONSTRAINT_FIELDS
  ) {
    return UNIQUE_CONSTRAINT_FIELDS[
      constraint as keyof typeof UNIQUE_CONSTRAINT_FIELDS
    ];
  }

  if (typeof error.detail !== 'string') {
    return undefined;
  }
  const match = /^Key \((email|username)\)=\(.+\) already exists\.$/.exec(
    error.detail,
  );
  return match?.[1] as 'email' | 'username' | undefined;
}

function isUniqueViolation(error: unknown): error is Record<string, unknown> {
  if (
    !isRecord(error) ||
    error.code !== UNIQUE_VIOLATION_CODE
  ) {
    return false;
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
