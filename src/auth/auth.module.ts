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
import {
  AUTH_CONFIG,
  AUTH_LOGIN_RATE_LIMITER,
  AUTH_LOGIN_REPOSITORY,
} from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthLoginRateLimiter } from './auth-login-rate-limiter.js';
import type {
  AuthLoginRateLimiterPort,
  AuthLoginTokenIssuer,
} from './auth-login-contracts.js';
import { AuthService, type AuthLoginRepository } from './auth.service.js';
import { issueToken } from './auth-token-issuer.js';
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
      ],
      provide: AuthService,
      useFactory: (
        dataSource: DataSource,
        loginRepository: AuthLoginRepository,
        loginRateLimiter: AuthLoginRateLimiterPort,
        jwtService: JwtService,
        authConfig: AuthConfig,
      ) => {
        const tokenIssuer: AuthLoginTokenIssuer = {
          issue: (username) => issueToken(jwtService, authConfig, username),
        };
        return new AuthService(
          dataSource,
          loginRepository,
          loginRateLimiter,
          tokenIssuer,
        );
      },
    },
    {
      provide: AUTH_LOGIN_RATE_LIMITER,
      useFactory: () => new AuthLoginRateLimiter(),
    },
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
})
export class AuthModule {}
