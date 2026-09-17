import { describe, expect, it } from 'vitest';
import {
  DatabaseResetConfigValidationError,
  getDatabaseResetConfig,
} from './database-reset-config.js';

const testDatabaseUrl =
  'postgresql://user:password@localhost:5432/nestjs_tutorial_test';

describe('getDatabaseResetConfig', () => {
  it('returns TEST_DATABASE_URL after explicit confirmation', () => {
    expect(
      getDatabaseResetConfig({
        DATABASE_URL: 'postgresql://user:password@localhost:5432/production',
        TEST_DATABASE_URL: testDatabaseUrl,
        CONFIRM_DATABASE_RESET: 'yes',
      }),
    ).toEqual({ url: testDatabaseUrl });
  });

  it('refuses an unconfirmed reset', () => {
    expect(() =>
      getDatabaseResetConfig({ TEST_DATABASE_URL: testDatabaseUrl }),
    ).toThrow(DatabaseResetConfigValidationError);
  });

  it('refuses a missing test database URL', () => {
    expect(() =>
      getDatabaseResetConfig({ CONFIRM_DATABASE_RESET: 'yes' }),
    ).toThrow('TEST_DATABASE_URL is required');
  });
});
