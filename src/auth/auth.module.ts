import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { OptionalAuthGuard, RequiredAuthGuard } from './auth.guards.js';
import { AuthThrottleService } from './auth-throttle.service.js';
import { DatabaseModule } from '../database/database.module.js';
@Module({ imports: [JwtModule.register({}), DatabaseModule], providers: [AuthService, AuthThrottleService, RequiredAuthGuard, OptionalAuthGuard], exports: [AuthService, AuthThrottleService, RequiredAuthGuard, OptionalAuthGuard] })
export class AuthModule {}
