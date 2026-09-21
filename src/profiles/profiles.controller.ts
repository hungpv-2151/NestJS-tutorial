import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
  AuthTokenGuard,
  type AuthenticatedRequest,
} from '../auth/auth-token.guard.js';
import { UserService } from '../users/user.service.js';
import { serializeProfile, type SerializedProfile } from './profile.serializer.js';
import {
  ProfileNotFoundError,
  ProfileService,
  SelfFollowError,
} from './profile.service.js';
import { FollowProfileSwagger, GetProfileSwagger } from './profiles.swagger.js';

@ApiTags('Profile')
@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly userService: UserService,
    private readonly profileService: ProfileService,
  ) {}

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

  @Post(':username/follow')
  @FollowProfileSwagger()
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthTokenGuard)
  async followProfile(
    @Param('username') username: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<SerializedProfile> {
    try {
      return serializeProfile(
        await this.profileService.follow(request.auth.sub, username),
        true,
      );
    } catch (error) {
      if (error instanceof ProfileNotFoundError) {
        throw new NotFoundException({ errors: { profile: ['not found'] } });
      }
      if (error instanceof SelfFollowError) {
        throw new UnprocessableEntityException({
          errors: { profile: ['cannot follow yourself'] },
        });
      }
      throw error;
    }
  }
}
