import { getTestDatabaseConfig } from '../config/database-config.js';

export interface DatabaseResetConfig {
  url: string;
}

export class DatabaseResetConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseResetConfigValidationError';
  }
}

export function getDatabaseResetConfig(
  environment: NodeJS.ProcessEnv = process.env,
): DatabaseResetConfig {
  if (environment.CONFIRM_DATABASE_RESET !== 'yes') {
    throw new DatabaseResetConfigValidationError(
      'Set CONFIRM_DATABASE_RESET=yes',
    );
  }

  return getTestDatabaseConfig(environment);
}
