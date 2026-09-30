import { User } from './user.entity.js';

export interface UserLookupRepository {
  findOneBy(
    criteria: Partial<Pick<User, 'email' | 'username'>>,
  ): Promise<User | null>;
  save(user: User): Promise<User>;
}

export interface UpdateUserRequest {
  bio?: string | null;
  image?: string | null;
}

export class UserService {
  constructor(private readonly repository: UserLookupRepository) {}

  async findByUsername(username: string): Promise<User | null> {
    return this.repository.findOneBy({ username });
  }

  async updateCurrentUser(
    username: string,
    update: UpdateUserRequest,
  ): Promise<User | null> {
    const user = await this.findByUsername(username);
    if (!user) {
      return null;
    }

    if (update.bio !== undefined) user.bio = update.bio;
    if (update.image !== undefined) user.image = update.image;
    return this.repository.save(user);
  }
}
