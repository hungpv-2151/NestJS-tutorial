import type { User } from '../../users/user.entity.js';

export interface CommentSerializationInput {
  id: number;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  author: Pick<User, 'bio' | 'image' | 'username'>;
}

export interface SerializedComment {
  id: number;
  createdAt: string;
  updatedAt: string;
  body: string;
  author: {
    bio: string | null;
    following: boolean;
    image: string | null;
    username: string;
  };
}

export function serializeComment(
  comment: CommentSerializationInput,
  authorFollowing = false,
): SerializedComment {
  return {
    id: comment.id,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    body: comment.body,
    author: {
      bio: comment.author.bio,
      following: authorFollowing,
      image: comment.author.image,
      username: comment.author.username,
    },
  };
}
