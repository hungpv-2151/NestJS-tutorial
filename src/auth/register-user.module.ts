import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DataSource } from 'typeorm';

import { getAuthConfig, toJwtModuleOptions } from '../config/auth-config.js';
import { DatabaseModule } from '../database/database.module.js';
import { UserRegistrationService } from '../users/user-registration.service.js';
import { AUTH_CONFIG, RegisterUserController } from './register-user.controller.js';

@Module({
  controllers: [RegisterUserController],
  imports: [
    DatabaseModule.register(),
    JwtModule.register(toJwtModuleOptions(getAuthConfig())),
  ],
  providers: [
    {
      provide: AUTH_CONFIG,
      useValue: getAuthConfig(),
    },
    {
      inject: [DataSource],
      provide: UserRegistrationService,
      useFactory: (dataSource: DataSource) => new UserRegistrationService(dataSource),
    },
  ],
})
export class RegisterUserModule {}
