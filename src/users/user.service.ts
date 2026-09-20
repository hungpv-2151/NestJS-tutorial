import { hashPassword } from '../common/security/password-hasher.js';
import {
  getDuplicateField,
  isUniqueViolation,
} from '../auth/auth-registration-support.js';
import { User } from './user.entity.js';

export interface UserLookupRepository {
  findOneBy(
    criteria: Partial<Pick<User, 'email' | 'username'>>,
  ): Promise<User | null>;
  save(user: User): Promise<User>;
}

export interface UpdateUserRequest {
  bio?: string | null;
  email?: string;
  image?: string | null;
  password?: string;
  username?: string;
}

export class UserUpdateConflictError extends Error {
  constructor(readonly field: 'email' | 'username') {
    super(`${field} has already been taken`);
  }
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

    await this.assertAvailable('email', update.email, user.email);
    await this.assertAvailable('username', update.username, user.username);
    await this.applyUpdate(user, update);
    try {
      return await this.repository.save(user);
    } catch (error) {
      const field = isUniqueViolation(error)
        ? getDuplicateField(error)
        : undefined;
      if (field) {
        throw new UserUpdateConflictError(field);
      }
      throw error;
    }
  }

  private async assertAvailable(
    field: 'email' | 'username',
    value: string | undefined,
    currentValue: string,
  ): Promise<void> {
    if (!value || value === currentValue) {
      return;
    }
    if (await this.repository.findOneBy({ [field]: value })) {
      throw new UserUpdateConflictError(field);
    }
  }

  private async applyUpdate(
    user: User,
    update: UpdateUserRequest,
  ): Promise<void> {
    if (update.email !== undefined) user.email = update.email;
    if (update.username !== undefined) user.username = update.username;
    if (update.bio !== undefined) user.bio = update.bio;
    if (update.image !== undefined) user.image = update.image;
    if (update.password !== undefined)
      user.passwordHash = await hashPassword(update.password);
  }
}
