import { Controller, Get, NotFoundException, Param } from '@nestjs/common';

import { UserService } from '../users/user.service.js';
import { serializeProfile, type SerializedProfile } from './profile.serializer.js';
import { GetProfileSwagger } from './profiles.swagger.js';

@Controller('profiles')
export class ProfilesController {
  constructor(private readonly userService: UserService) {}

  @Get(':username')
  @GetProfileSwagger()
  async getProfile(
    @Param('username') username: string,
  ): Promise<SerializedProfile> {
    const user = await this.userService.findByUsername(username);
    if (!user) {
      throw new NotFoundException({ errors: { profile: ['not found'] } });
    }
    return serializeProfile(user);
  }
}
