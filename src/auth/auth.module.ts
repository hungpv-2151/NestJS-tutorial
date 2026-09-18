import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { getAuthConfig, toJwtModuleOptions } from '../config/auth-config.js';
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
import { AUTH_CONFIG } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
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
      provide: AuthService,
      useFactory: (dataSource: DataSource) =>
        new AuthService(dataSource),
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
