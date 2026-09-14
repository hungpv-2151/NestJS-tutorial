import { Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { OptionalAuthGuard, RequiredAuthGuard } from '../auth/auth.guards.js';
import { CurrentPrincipal } from '../auth/principal.decorator.js';
import type { Principal } from '../auth/auth.service.js';
import { ProfilesService } from './profiles.service.js';
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}
  @UseGuards(OptionalAuthGuard) @Get(':username') get(@Param('username') username: string, @CurrentPrincipal() principal?: Principal) { return this.profiles.get(username, principal?.id); }
  @UseGuards(RequiredAuthGuard) @Post(':username/follow') @HttpCode(200) follow(@Param('username') username: string, @CurrentPrincipal() principal: Principal) { return this.profiles.follow(username, principal.id); }
  @UseGuards(RequiredAuthGuard) @Delete(':username/follow') unfollow(@Param('username') username: string, @CurrentPrincipal() principal: Principal) { return this.profiles.unfollow(username, principal.id); }
}
