import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../users/user.entity.js';
import { UserService } from '../users/user.service.js';
import { UserFollow } from './user-follow.entity.js';

export class ProfileNotFoundError extends Error {}
export class SelfFollowError extends Error {}

@Injectable()
export class ProfileService {
  constructor(
    private readonly userService: UserService,
    @InjectRepository(UserFollow)
    private readonly follows: Repository<UserFollow>,
  ) {}

  async follow(followerUsername: string, username: string): Promise<User> {
    const [follower, following] = await Promise.all([
      this.userService.findByUsername(followerUsername),
      this.userService.findByUsername(username),
    ]);
    if (!following) throw new ProfileNotFoundError();
    if (follower?.id === following.id) throw new SelfFollowError();
    if (!follower) throw new ProfileNotFoundError();

    await this.follows
      .createQueryBuilder()
      .insert()
      .into(UserFollow)
      .values({ followerId: follower.id, followingId: following.id })
      .orIgnore()
      .execute();
    return following;
  }
}
