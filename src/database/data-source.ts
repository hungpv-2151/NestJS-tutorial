import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getDatabaseConfig } from '../config/database-config.js';
import { User } from '../users/user.entity.js';
import { WelcomeMailOutbox } from '../jobs/welcome-mail-outbox.entity.js';
import { UserFollow } from '../profiles/user-follow.entity.js';
import { CreateUsers1710000000000 } from './migrations/1710000000000-create-users.js';
import { CreateWelcomeMailOutbox1710000001000 } from './migrations/1710000001000-create-welcome-mail-outbox.js';
import { CreateUserFollows1710000002000 } from './migrations/1710000002000-create-user-follows.js';

export const dataSourceOptions = {
  type: 'postgres' as const,
  url: getDatabaseConfig().url,
  entities: [User, WelcomeMailOutbox, UserFollow],
  migrations: [
    CreateUsers1710000000000,
    CreateWelcomeMailOutbox1710000001000,
    CreateUserFollows1710000002000,
  ],
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
