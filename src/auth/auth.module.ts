import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { getAuthConfig, toJwtModuleOptions } from '../config/auth-config.js';
import type { AuthConfig } from '../config/auth-config.js';
import { DatabaseModule } from '../database/database.module.js';
import { WelcomeMailOutbox } from '../jobs/welcome-mail-outbox.entity.js';
import {
  BullMqWelcomeMailQueue,
  WELCOME_MAIL_QUEUE,
} from '../jobs/welcome-mail-queue.js';
import {
  TypeOrmWelcomeMailOutboxStore,
  WELCOME_MAIL_OUTBOX_STORE,
} from '../jobs/welcome-mail-outbox-store.js';
import {
  WelcomeMailOutboxRelay,
  WelcomeMailOutboxRelayRunner,
} from '../jobs/welcome-mail-outbox-relay.js';
import { User } from '../users/user.entity.js';
import { UserService } from '../users/user.service.js';
import {
  AUTH_CONFIG,
  AUTH_LOGIN_RATE_LIMITER,
  AUTH_LOGIN_REPOSITORY,
  AUTH_TOKEN_DENY_LIST_CLIENT,
  AUTH_TOKEN_VERIFIER,
} from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthLoginRateLimiter } from './auth-login-rate-limiter.js';
import { AuthTokenGuard } from './auth-token.guard.js';
import { AuthCurrentUserHandler } from './auth-current-user-handler.js';
import { AuthUpdateUserHandler } from './auth-update-user-handler.js';
import type { AuthLoginRateLimiterPort, AuthLoginTokenIssuer } from './auth-login-contracts.js';
import { AuthService, type AuthLoginRepository, type AuthTokenVerifier } from './auth.service.js';
import { issueToken } from './auth-token-issuer.js';
import { RedisTokenDenyListClient } from './redis-token-deny-list-client.js';
import { TokenDenyListService, type TokenDenyListClient } from './token-deny-list.service.js';
import { WELCOME_MAIL_OUTBOX_RELAY } from '../jobs/welcome-mail-outbox-relay.constants.js';

@Module({
  controllers: [AuthController],
  imports: [
    DatabaseModule.register(),
    JwtModule.register(toJwtModuleOptions(getAuthConfig())),
    TypeOrmModule.forFeature([User, WelcomeMailOutbox]),
  ],
  providers: [
    {
      provide: AUTH_CONFIG,
      useValue: getAuthConfig(),
    },
    {
      inject: [DataSource],
      provide: AUTH_LOGIN_REPOSITORY,
      useFactory: (dataSource: DataSource) => ({
        findByEmail: (email: string) =>
          dataSource
            .getRepository(User)
            .createQueryBuilder('user')
            .addSelect('user.passwordHash')
            .where('user.email = :email', { email })
            .getOne(),
      }),
    },
    {
      inject: [
        DataSource,
        AUTH_LOGIN_REPOSITORY,
        AUTH_LOGIN_RATE_LIMITER,
        JwtService,
        AUTH_CONFIG,
        AUTH_TOKEN_VERIFIER,
        UserService,
        TokenDenyListService,
      ],
      provide: AuthService,
      useFactory: (
        dataSource: DataSource,
        loginRepository: AuthLoginRepository,
        loginRateLimiter: AuthLoginRateLimiterPort,
        jwtService: JwtService,
        authConfig: AuthConfig,
        tokenVerifier: AuthTokenVerifier,
        userService: UserService,
        tokenDenyList: TokenDenyListService,
      ) => {
        const tokenIssuer: AuthLoginTokenIssuer = {
          issue: (username) => issueToken(jwtService, authConfig, username),
        };
        return new AuthService(
          dataSource,
          loginRepository,
          loginRateLimiter,
          tokenIssuer,
          undefined,
          tokenVerifier,
          userService,
          tokenDenyList,
        );
      },
    },
    {
      inject: [JwtService],
      provide: AUTH_TOKEN_VERIFIER,
      useFactory: (jwtService: JwtService): AuthTokenVerifier => ({
        verify: (token) => jwtService.verifyAsync(token),
      }),
    },
    {
      provide: AUTH_TOKEN_DENY_LIST_CLIENT,
      useFactory: () => new RedisTokenDenyListClient(),
    },
    {
      inject: [AUTH_TOKEN_DENY_LIST_CLIENT],
      provide: TokenDenyListService,
      useFactory: (client: TokenDenyListClient) => new TokenDenyListService(client),
    },
    {
      provide: AUTH_LOGIN_RATE_LIMITER,
      useFactory: () => new AuthLoginRateLimiter(),
    },
    {
      inject: [DataSource],
      provide: UserService,
      useFactory: (dataSource: DataSource) =>
        new UserService(dataSource.getRepository(User)),
    },
    AuthTokenGuard,
    AuthCurrentUserHandler,
    AuthUpdateUserHandler,
    {
      provide: WELCOME_MAIL_QUEUE,
      useFactory: () => new BullMqWelcomeMailQueue(),
    },
    {
      inject: [DataSource],
      provide: WELCOME_MAIL_OUTBOX_STORE,
      useFactory: (dataSource: DataSource) =>
        new TypeOrmWelcomeMailOutboxStore(dataSource),
    },
    {
      inject: [WELCOME_MAIL_OUTBOX_STORE, WELCOME_MAIL_QUEUE],
      provide: WELCOME_MAIL_OUTBOX_RELAY,
      useFactory: (
        outboxStore: TypeOrmWelcomeMailOutboxStore,
        queue: BullMqWelcomeMailQueue,
      ) => new WelcomeMailOutboxRelay(outboxStore, queue),
    },
    WelcomeMailOutboxRelayRunner,
  ],
  exports: [UserService],
})
export class AuthModule {}
