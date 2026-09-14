import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';
@Module({ imports: [AuthModule, DatabaseModule], controllers: [ProfilesController], providers: [ProfilesService] })
export class ProfilesModule {}
