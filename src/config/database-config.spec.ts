import { describe, expect, it } from 'vitest';
import {
  DatabaseConfigValidationError,
  getDatabaseConfig,
  isDatabaseEnabled,
} from './database-config.js';

describe('getDatabaseConfig', () => {
  it('returns a PostgreSQL connection URL', () => {
    expect(
      getDatabaseConfig({
        DATABASE_URL: 'postgresql://user:password@localhost:5432/app_dev',
      }),
    ).toEqual({ url: 'postgresql://user:password@localhost:5432/app_dev' });
  });

  it.each([
    [{}, 'DATABASE_URL is required'],
    [{ DATABASE_URL: 'mysql://localhost/app_dev' }, 'DATABASE_URL must be PostgreSQL'],
    [{ DATABASE_URL: 'postgresql://' }, 'DATABASE_URL must be PostgreSQL'],
    [{ DATABASE_URL: 'postgresql://localhost' }, 'DATABASE_URL must be PostgreSQL'],
  ])('rejects invalid configuration', (environment, message) => {
    expect(() => getDatabaseConfig(environment)).toThrow(
      DatabaseConfigValidationError,
    );
    expect(() => getDatabaseConfig(environment)).toThrow(message);
  });
});

describe('isDatabaseEnabled', () => {
  it('defaults to disabled and enables only an explicit true value', () => {
    expect(isDatabaseEnabled({})).toBe(false);
    expect(isDatabaseEnabled({ DATABASE_ENABLED: 'false' })).toBe(false);
    expect(isDatabaseEnabled({ DATABASE_ENABLED: 'true' })).toBe(true);
  });

  it('rejects an invalid enablement value', () => {
    expect(() => isDatabaseEnabled({ DATABASE_ENABLED: 'yes' })).toThrow(
      'DATABASE_ENABLED must be true or false',
    );
  });
});
