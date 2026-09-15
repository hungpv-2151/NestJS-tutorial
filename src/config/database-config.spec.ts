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
    TEST_DATABASE_ALLOWED_HOSTS: 'test-db.example.com',
    TEST_DATABASE_ALLOWED_NAMES: 'app_test',
  };

  it('returns an explicitly allowlisted test database URL', () => {
    expect(getTestDatabaseConfig(testEnvironment)).toEqual({
      url: testEnvironment.TEST_DATABASE_URL,
    });
  });

  it.each([
    [
      { ...testEnvironment, TEST_DATABASE_URL: 'postgresql://user:password@dev-db.example.com:5432/app_dev' },
      'TEST_DATABASE_URL host is not allowlisted',
    ],
    [
      { ...testEnvironment, TEST_DATABASE_URL: 'postgresql://user:password@test-db.example.com:5432/app_prod' },
      'TEST_DATABASE_URL database is not allowlisted',
    ],
    [
      { ...testEnvironment, TEST_DATABASE_ALLOWED_HOSTS: undefined },
      'TEST_DATABASE_ALLOWED_HOSTS is required',
    ],
    [
      { ...testEnvironment, TEST_DATABASE_ALLOWED_NAMES: undefined },
      'TEST_DATABASE_ALLOWED_NAMES is required',
    ],
  ])('rejects unsafe test database configuration', (environment, message) => {
    expect(() => getTestDatabaseConfig(environment)).toThrow(
      DatabaseConfigValidationError,
    );
    expect(() => getTestDatabaseConfig(environment)).toThrow(message);
  });
});
