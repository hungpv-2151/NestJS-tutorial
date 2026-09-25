import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { ProfilesController } from './profiles.controller.js';

@Module({
  controllers: [ProfilesController],
  imports: [AuthModule],
})
export class ProfilesModule {}
