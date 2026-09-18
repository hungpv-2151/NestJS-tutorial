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
  WELCOME_MAIL_OUTBOX_RELAY,
} from '../jobs/welcome-mail-outbox-relay.js';
import { User } from '../users/user.entity.js';
import { UserRegistrationService } from '../users/user-registration.service.js';
import {
  AUTH_CONFIG,
  RegisterUserController,
} from './register-user.controller.js';

@Module({
  controllers: [RegisterUserController],
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
      provide: UserRegistrationService,
      useFactory: (dataSource: DataSource) =>
        new UserRegistrationService(dataSource),
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
export class RegisterUserModule {}
