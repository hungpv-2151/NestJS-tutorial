import { User } from './user.entity.js';

export interface UserLookupRepository {
  findOneBy(criteria: Pick<User, 'username'>): Promise<User | null>;
}

export class UserService {
  constructor(private readonly repository: UserLookupRepository) {}

  async findByUsername(username: string): Promise<User | null> {
    return this.repository.findOneBy({ username });
  }
}
