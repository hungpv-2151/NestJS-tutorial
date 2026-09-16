import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getDatabaseConfig } from '../config/database-config.js';
import { User } from '../users/user.entity.js';
import { CreateUsers1710000000000 } from './migrations/1710000000000-create-users.js';

export const dataSourceOptions = {
  type: 'postgres' as const,
  url: getDatabaseConfig().url,
  entities: [User],
  migrations: [CreateUsers1710000000000],
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
