export interface UserToSerialize {
  bio: string | null;
  email: string;
  image: string | null;
  username: string;
}

export interface SerializedUser {
  user: UserToSerialize & { token: string };
}

export function serializeUser(user: UserToSerialize, token: string): SerializedUser {
  return {
    user: {
      bio: user.bio,
      email: user.email,
      image: user.image,
      token,
      username: user.username,
    },
  };
}
