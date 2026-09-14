import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma, User } from '@prisma/client';
import { ApiError } from '../common/filters/api-exception.filter.js';
import { AuthService } from '../auth/auth.service.js';
import { ARGON2ID_OPTIONS } from '../auth/password-policy.js';
import { PrismaService } from '../database/prisma.service.js';
import { UpdateFields } from './user.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}
  async register(input: { username: string; email: string; password: string }) { try { const user = await this.prisma.user.create({ data: { username: input.username, email: input.email, passwordHash: await this.hash(input.password) } }); return this.serialize(user); } catch (error) { throw this.unique(error, input); } }
  async login(email: string, password: string) { const user = await this.prisma.user.findUnique({ where: { email } }); if (!user || !(await argon2.verify(user.passwordHash, password))) throw new UnauthorizedException({ errors: { credentials: ['invalid'] } }); return this.serialize(user); }
  async current(id: number) { return this.serialize(await this.find(id)); }
  async update(id: number, input: UpdateFields) { const { password, ...fields } = input; const data: Prisma.UserUpdateInput = { ...fields, bio: this.nil(input.bio), image: this.nil(input.image) }; if (password) { data.passwordHash = await this.hash(password); data.tokenVersion = { increment: 1 }; } try { return this.serialize(await this.prisma.user.update({ where: { id }, data })); } catch (error) { throw this.unique(error, input); } }
  private async serialize(user: User) { return { user: { email: user.email, username: user.username, bio: user.bio, image: user.image, token: await this.auth.sign(user) } }; }
  private async find(id: number): Promise<User> { const user = await this.prisma.user.findUnique({ where: { id } }); if (!user) throw new UnauthorizedException({ errors: { token: ['is invalid'] } }); return user; }
  private async hash(password: string): Promise<string> { return argon2.hash(password, ARGON2ID_OPTIONS); }
  private nil(value: string | null | undefined): string | null | undefined { return value === '' ? null : value; }
  private unique(error: unknown, input: { username?: string; email?: string }): Error { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { const target = error.meta?.target; const name = Array.isArray(target) ? target[0] : target; if (name === 'username' || name === 'users_username_key') return ApiError.duplicate('username'); if (name === 'email' || name === 'users_email_key') return ApiError.duplicate('email'); if (input.username && !input.email) return ApiError.duplicate('username'); if (input.email && !input.username) return ApiError.duplicate('email'); } return error instanceof Error ? error : new Error('User persistence failed'); }
}
