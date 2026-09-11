import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service.js';
import { environmentKeys } from '../config/environment.validation.js';

export type Principal = { id: number; username: string };

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  async sign(user: { id: number; tokenVersion: number }): Promise<string> {
    return this.jwt.signAsync({ sub: user.id, ver: user.tokenVersion }, {
      algorithm: 'HS256', expiresIn: '15m', secret: this.config.getOrThrow(environmentKeys.jwtSecret), issuer: this.config.getOrThrow(environmentKeys.jwtIssuer), audience: this.config.getOrThrow(environmentKeys.jwtAudience),
    });
  }

  async principal(header: string | undefined, required: boolean): Promise<Principal | undefined> {
    if (!header) {
      if (required) throw new UnauthorizedException({ errors: { token: ['is missing'] } });
      return undefined;
    }
    const match = /^Token ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(header);
    if (!match) throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
    try {
      const payload = await this.jwt.verifyAsync<{ sub: number; ver: number }>(match[1], {
        algorithms: ['HS256'], secret: this.config.getOrThrow(environmentKeys.jwtSecret), issuer: this.config.getOrThrow(environmentKeys.jwtIssuer), audience: this.config.getOrThrow(environmentKeys.jwtAudience),
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, username: true, tokenVersion: true } });
      if (!user || user.tokenVersion !== payload.ver) throw new Error('invalid token version');
      return { id: user.id, username: user.username };
    } catch {
      throw new UnauthorizedException({ errors: { token: ['is invalid'] } });
    }
  }
}
