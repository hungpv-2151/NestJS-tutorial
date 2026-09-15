import { describe, expect, it } from 'vitest';
import {
  DatabaseConfigValidationError,
  getDatabaseConfig,
  getTestDatabaseConfig,
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

describe('getTestDatabaseConfig', () => {
  const testEnvironment = {
    TEST_DATABASE_URL: 'postgresql://user:password@test-db.example.com:5432/app_test',
  };

  it('returns a PostgreSQL test database URL', () => {
    expect(getTestDatabaseConfig(testEnvironment)).toEqual({
      url: testEnvironment.TEST_DATABASE_URL,
    });
  });

  it.each([
    [{}, 'TEST_DATABASE_URL is required'],
    [{ TEST_DATABASE_URL: 'mysql://localhost/app_test' }, 'DATABASE_URL must be PostgreSQL'],
  ])('rejects invalid test database configuration', (environment, message) => {
    expect(() => getTestDatabaseConfig(environment)).toThrow(
      DatabaseConfigValidationError,
    );
    expect(() => getTestDatabaseConfig(environment)).toThrow(message);
  });
});
