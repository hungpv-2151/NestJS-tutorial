import * as argon2 from 'argon2';

import { WelcomeMailOutbox } from '../jobs/welcome-mail-outbox.entity.js';
import { User } from '../users/user.entity.js';
import {
  INVALID_PASSWORD_HASH,
  matchesPassword,
} from './auth-password-verifier.js';
import {
  AuthConflictError,
  AuthPersistenceError,
  getDuplicateField,
  isUniqueViolation,
  type AuthTransactionManager,
  type UserRepository,
  type WelcomeMailOutboxRepository,
} from './auth-registration-support.js';
import { isTokenClaims, type TokenClaims } from './token-claims.js';
import {
  TokenDenyListService,
  TokenDenyListUnavailableError,
} from './token-deny-list.service.js';

export {
  AuthConflictError,
  AuthPersistenceError,
  type UserRepository,
  type WelcomeMailOutboxRepository,
} from './auth-registration-support.js';

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

export interface AuthTransaction {
  transaction<T>(
    work: (manager: AuthTransactionManager) => Promise<T>,
  ): Promise<T>;
}

export class AuthInvalidCredentialsError extends Error {}
export class AuthInvalidTokenError extends Error {}
export class AuthLogoutUnavailableError extends Error {}

export class AuthService {
  constructor(
    private readonly dataSource: AuthTransaction,
    private readonly loginRepository: AuthLoginRepository,
    private readonly passwordVerifier: AuthPasswordVerifier = {
      matches: matchesPassword,
    },
    private readonly tokenVerifier?: AuthTokenVerifier,
    private readonly tokenDenyList?: TokenDenyListService,
  ) {}

  async authenticate(token: string): Promise<TokenClaims> {
    if (!this.tokenVerifier) {
      throw new AuthInvalidTokenError();
    }
    try {
      const claims = await this.tokenVerifier.verify(token);
      if (!isTokenClaims(claims)) {
        throw new AuthInvalidTokenError();
      }
      if (this.tokenDenyList && (await this.tokenDenyList.isDenied(claims.jti))) {
        throw new AuthInvalidTokenError();
      }
      return claims;
    } catch (error) {
      if (error instanceof TokenDenyListUnavailableError) {
        throw error;
      }
      throw new AuthInvalidTokenError();
    }
  }

  async logout(claims: Pick<TokenClaims, 'exp' | 'jti'>): Promise<void> {
    if (!this.tokenDenyList) {
      throw new AuthLogoutUnavailableError();
    }
    await this.tokenDenyList.deny(claims);
  }

  async login(email: string, password: string): Promise<User> {
    const user = await this.loginRepository.findByEmail(email);
    const passwordMatches = await this.passwordVerifier.matches(
      user?.passwordHash ?? INVALID_PASSWORD_HASH,
      password,
    );
    if (!user || !passwordMatches) {
      throw new AuthInvalidCredentialsError();
    }
    return user;
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
