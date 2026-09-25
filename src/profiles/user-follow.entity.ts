import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { User } from '../users/user.entity.js';

@Entity({ name: 'user_follows' })
export class UserFollow {
  @PrimaryColumn({ name: 'follower_id', type: 'uuid' })
  followerId!: string;

  @PrimaryColumn({ name: 'following_id', type: 'uuid' })
  followingId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follower_id' })
  follower!: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'following_id' })
  following!: User;
}
