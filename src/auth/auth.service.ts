import * as argon2 from 'argon2';

import { WelcomeMailOutbox } from '../jobs/welcome-mail-outbox.entity.js';
import { User } from '../users/user.entity.js';
import { UserService } from '../users/user.service.js';
import type {
  AuthLoginRateLimiterPort,
  AuthLoginRequest,
  AuthLoginTokenIssuer,
  AuthenticatedLogin,
} from './auth-login-contracts.js';
import {
  TIMING_PARITY_PASSWORD_HASH,
  matchesPassword,
} from './auth-password-verifier.js';
import type { TokenClaims } from './token-claims.js';

const UNIQUE_VIOLATION_CODE = '23505';
const UNIQUE_CONSTRAINT_FIELDS = {
  users_email_key: 'email',
  users_username_key: 'username',
} as const;
type AuthConflictField = 'body' | 'email' | 'username';

export type RegisterRequest = Pick<User, 'email' | 'username'> & {
  password: string;
};

export interface AuthenticatedUser {
  email: string;
  username: string;
}

export interface AuthLoginRepository {
  findByEmail(email: string): Promise<User | null>;
}

export interface AuthPasswordVerifier {
  matches(hash: string, password: string): Promise<boolean>;
}

export interface AuthTokenVerifier {
  verify(token: string): Promise<TokenClaims>;
}

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

export interface AuthTransaction {
  transaction<T>(
    work: (manager: AuthTransactionManager) => Promise<T>,
  ): Promise<T>;
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

export class AuthInvalidCredentialsError extends Error {}
export class AuthInvalidTokenError extends Error {}

export class AuthService {
  constructor(
    private readonly dataSource: AuthTransaction,
    private readonly loginRepository: AuthLoginRepository,
    private readonly loginRateLimiter: AuthLoginRateLimiterPort,
    private readonly tokenIssuer: AuthLoginTokenIssuer,
    private readonly passwordVerifier: AuthPasswordVerifier = {
      matches: matchesPassword,
    },
    private readonly tokenVerifier?: AuthTokenVerifier,
    private readonly userService?: Pick<UserService, 'findByUsername'>,
  ) {}

  async authenticate(token: string): Promise<TokenClaims> {
    if (!this.tokenVerifier) throw new AuthInvalidTokenError();
    try {
      return await this.tokenVerifier.verify(token);
    } catch {
      throw new AuthInvalidTokenError();
    }
  }

  async currentUser(username: string): Promise<User> {
    const user = await this.userService?.findByUsername(username);
    if (!user) throw new AuthInvalidTokenError();
    return user;
  }

  async login(request: AuthLoginRequest): Promise<AuthenticatedLogin> {
    await this.loginRateLimiter.consume(request.email, request.ipAddress);
    const user = await this.loginRepository.findByEmail(request.email);
    const passwordMatches = await this.passwordVerifier.matches(
      user?.passwordHash ?? TIMING_PARITY_PASSWORD_HASH,
      request.password,
    );
    if (!user || !passwordMatches) {
      throw new AuthInvalidCredentialsError();
    }
    const token = await this.tokenIssuer.issue(user.username);
    return { token, user };
  }

  async register(request: RegisterRequest): Promise<AuthenticatedUser> {
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
      if (error instanceof AuthConflictError) {
        throw new AuthConflictError(error.field);
      }
      if (isUniqueViolation(error)) {
        throw new AuthConflictError(getDuplicateField(error) ?? 'body');
      }
      throw new AuthPersistenceError(error);
    }
  }

  private async assertAvailable(
    repository: UserRepository,
    field: 'email' | 'username',
    value: string,
  ): Promise<void> {
    if (await repository.findOneBy({ [field]: value })) {
      throw new AuthConflictError(field);
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
