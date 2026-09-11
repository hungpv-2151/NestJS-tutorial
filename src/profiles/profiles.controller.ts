import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { OptionalAuthGuard } from '../auth/auth.guards.js';
import { CurrentPrincipal } from '../auth/principal.decorator.js';
import type { Principal } from '../auth/auth.service.js';
import { ProfilesService } from './profiles.service.js';
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}
  @UseGuards(OptionalAuthGuard) @Get(':username') get(@Param('username') username: string, @CurrentPrincipal() principal?: Principal) { return this.profiles.get(username, principal?.id); }
}
