import type { User } from '../users/user.entity.js';

export interface SerializedProfile {
  profile: {
    bio: string | null;
    following: boolean;
    image: string | null;
    username: string;
  };
}

export function serializeProfile(user: User): SerializedProfile {
  return {
    profile: {
      bio: user.bio,
      following: false,
      image: user.image,
      username: user.username,
    },
  };
}
