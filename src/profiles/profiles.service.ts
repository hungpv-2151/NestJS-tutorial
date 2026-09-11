import { Injectable } from '@nestjs/common';
import { ApiError } from '../common/filters/api-exception.filter.js';
import { PrismaService } from '../database/prisma.service.js';
@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}
  async get(username: string, viewerId?: number) {
    const user = await this.prisma.user.findUnique({ where: { username }, select: { id: true, username: true, bio: true, image: true, followers: viewerId ? { where: { followerId: viewerId }, select: { followerId: true } } : false } });
    if (!user) throw ApiError.notFound('profile');
    return { profile: { username: user.username, bio: user.bio, image: user.image, following: viewerId ? user.followers.length > 0 : false } };
  }
}
