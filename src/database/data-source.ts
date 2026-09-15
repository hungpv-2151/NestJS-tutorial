import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getDatabaseConfig } from '../config/database-config.js';

export const dataSourceOptions = {
  type: 'postgres' as const,
  url: getDatabaseConfig().url,
  entities: [],
  migrations: [],
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
