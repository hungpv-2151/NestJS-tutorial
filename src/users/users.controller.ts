import { Body, Controller, Get, HttpCode, Post, Put, Req, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthThrottleService } from '../auth/auth-throttle.service.js';
import { CurrentPrincipal } from '../auth/principal.decorator.js';
import { RequiredAuthGuard } from '../auth/auth.guards.js';
import type { Principal } from '../auth/auth.service.js';
import { LoginUserDto, RegisterUserDto, UpdateUserDto } from './user.dto.js';
import { UsersService } from './users.service.js';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService, private readonly throttle: AuthThrottleService) {}
  @Post('users') register(@Req() request: Request, @Body() body: RegisterUserDto) { this.throttle.check('register', request.socket.remoteAddress ?? 'unknown', body.user.email); return this.users.register(body.user); }
  @Post('users/login') @HttpCode(200) login(@Req() request: Request, @Body() body: LoginUserDto) { this.throttle.check('login', request.socket.remoteAddress ?? 'unknown', body.user.email); return this.users.login(body.user.email, body.user.password); }
  @UseGuards(RequiredAuthGuard) @Get('user') current(@CurrentPrincipal() principal: Principal) { return this.users.current(principal.id); }
  @UseGuards(RequiredAuthGuard) @Put('user') update(@CurrentPrincipal() principal: Principal, @Body() body: UpdateUserDto) { if (Object.values(body.user).every((value) => value === undefined)) throw new UnprocessableEntityException({ errors: { user: ['must not be empty'] } }); return this.users.update(principal.id, body.user); }
}
