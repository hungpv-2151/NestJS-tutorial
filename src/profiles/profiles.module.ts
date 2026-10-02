import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfileService } from './profile.service.js';
import { UserFollow } from './user-follow.entity.js';

@Module({
  controllers: [ProfilesController],
  imports: [AuthModule, TypeOrmModule.forFeature([UserFollow])],
  providers: [ProfileService],
})
export class ProfilesModule {}
