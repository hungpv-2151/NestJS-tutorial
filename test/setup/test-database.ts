import { getTestDatabaseConfig } from '../../src/config/database-config.js';

if (!process.env.TEST_DATABASE_URL) {
  process.loadEnvFile('.env');
}

process.env.DATABASE_URL = getTestDatabaseConfig().url;
