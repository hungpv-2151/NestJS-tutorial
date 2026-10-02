import { WelcomeMailOutbox } from '../jobs/welcome-mail-outbox.entity.js';
import { User } from '../users/user.entity.js';

const UNIQUE_VIOLATION_CODE = '23505';
const UNIQUE_CONSTRAINT_FIELDS = {
  users_email_key: 'email',
  users_username_key: 'username',
} as const;

export type AuthConflictField = 'body' | 'email' | 'username';

export interface UserRepository {
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

export interface AuthTransactionManager {
  getRepository(entity: typeof User): UserRepository;
  getRepository(entity: typeof WelcomeMailOutbox): WelcomeMailOutboxRepository;
}

export class AuthConflictError extends Error {
  constructor(readonly field: AuthConflictField) {
    super(`${field} has already been taken`);
  }
}

export class AuthPersistenceError extends Error {
  constructor(cause: unknown) {
    super('user registration could not be saved', { cause });
  }
}

export function getDuplicateField(error: Record<string, unknown>):
  | 'email'
  | 'username'
  | undefined {
  const constraint = error.constraint;
  if (typeof constraint === 'string' && constraint in UNIQUE_CONSTRAINT_FIELDS) {
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

export function isUniqueViolation(error: unknown): error is Record<string, unknown> {
  return isRecord(error) && error.code === UNIQUE_VIOLATION_CODE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
