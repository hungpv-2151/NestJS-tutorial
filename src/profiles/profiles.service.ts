import { Injectable, UnprocessableEntityException } from '@nestjs/common';
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

  async follow(username: string, followerId: number) {
    return this.changeFollow(username, followerId, true);
  }

  async unfollow(username: string, followerId: number) {
    return this.changeFollow(username, followerId, false);
  }

  private async changeFollow(username: string, followerId: number, shouldFollow: boolean) {
    const target = await this.prisma.user.findUnique({
      where: { username }, select: { id: true, username: true, bio: true, image: true },
    });
    if (!target) throw ApiError.notFound('profile');
    if (target.id === followerId) {
      throw new UnprocessableEntityException({ errors: { profile: ['cannot follow yourself'] } });
    }
    try {
      if (shouldFollow) {
        await this.prisma.follow.upsert({
          where: { followerId_followingId: { followerId, followingId: target.id } },
          create: { followerId, followingId: target.id }, update: {},
        });
      } else {
        await this.prisma.follow.deleteMany({ where: { followerId, followingId: target.id } });
        const exists = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
        if (!exists) throw ApiError.notFound('profile');
      }
    } catch {
      const exists = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
      if (!exists) throw ApiError.notFound('profile');
      throw new UnprocessableEntityException({ errors: { profile: ['cannot change follow state'] } });
    }
    return { profile: { username: target.username, bio: target.bio, image: target.image, following: shouldFollow } };
  }
}
