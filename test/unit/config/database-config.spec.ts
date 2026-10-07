import { describe, expect, it } from 'vitest';
import {
  DatabaseConfigValidationError,
  getDatabaseConfig,
  getTestDatabaseConfig,
} from '../../../src/config/database-config.js';

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
    [
      { DATABASE_URL: 'mysql://localhost/app_dev' },
      'DATABASE_URL must be PostgreSQL',
    ],
    [{ DATABASE_URL: 'postgresql://' }, 'DATABASE_URL must be PostgreSQL'],
    [
      { DATABASE_URL: 'postgresql://localhost' },
      'DATABASE_URL must be PostgreSQL',
    ],
  ])('rejects invalid configuration', (environment, message) => {
    expect(() => getDatabaseConfig(environment)).toThrow(
      DatabaseConfigValidationError,
    );
    expect(() => getDatabaseConfig(environment)).toThrow(message);
  });
});

describe('getTestDatabaseConfig', () => {
  const testEnvironment = {
    TEST_DATABASE_URL:
      'postgresql://user:password@test-db.example.com:5432/app_test',
  };

  it('returns a PostgreSQL test database URL', () => {
    expect(getTestDatabaseConfig(testEnvironment)).toEqual({
      url: testEnvironment.TEST_DATABASE_URL,
    });
  });

  it('rejects the application database even when credentials differ', () => {
    expect(() =>
      getTestDatabaseConfig({
        DATABASE_URL: 'postgresql://app:dev@localhost:5432/nestjs_tutorial',
        TEST_DATABASE_URL:
          'postgres://test:other@LOCALHOST/nestjs_tutorial?sslmode=disable',
      }),
    ).toThrow('TEST_DATABASE_URL must target a different database');
  });

  it('rejects loopback aliases for the same database target', () => {
    expect(() =>
      getTestDatabaseConfig({
        DATABASE_URL: 'postgresql://app:dev@localhost:5432/nestjs_tutorial',
        TEST_DATABASE_URL: 'postgresql://test:other@127.0.0.1/nestjs_tutorial',
      }),
    ).toThrow('TEST_DATABASE_URL must target a different database');
  });

  it('rejects a trailing-dot localhost alias for the same database target', () => {
    expect(() =>
      getTestDatabaseConfig({
        DATABASE_URL: 'postgresql://app:dev@localhost:5432/nestjs_tutorial',
        TEST_DATABASE_URL: 'postgresql://test:other@localhost./nestjs_tutorial',
      }),
    ).toThrow('TEST_DATABASE_URL must target a different database');
  });

  it('rejects a connection target overridden by URL query parameters', () => {
    expect(() =>
      getTestDatabaseConfig({
        DATABASE_URL: 'postgresql://app:dev@localhost:5432/nestjs_tutorial',
        TEST_DATABASE_URL:
          'postgresql://test:other@different-host/nestjs_tutorial?host=localhost&port=5432',
      }),
    ).toThrow('TEST_DATABASE_URL must target a different database');
  });

  it('rejects empty host and port overrides that fall back to the URL authority', () => {
    expect(() =>
      getTestDatabaseConfig({
        TEST_DATABASE_URL:
          'postgresql://test:other@localhost:5432/nestjs_tutorial?host=&port=',
      }),
    ).toThrow('TEST_DATABASE_URL must not contain empty, repeated');
  });

  it('rejects repeated target parameters with ambiguous parser precedence', () => {
    expect(() =>
      getTestDatabaseConfig({
        DATABASE_URL: 'postgresql://app:dev@localhost:5432/nestjs_tutorial',
        TEST_DATABASE_URL:
          'postgresql://test:other@different-host/nestjs_tutorial?host=other&host=localhost&port=5432&port=5432',
      }),
    ).toThrow('TEST_DATABASE_URL must not contain empty, repeated');
  });

  it('normalizes numeric port overrides before comparing the target', () => {
    expect(() =>
      getTestDatabaseConfig({
        DATABASE_URL: 'postgresql://app:dev@localhost:5432/nestjs_tutorial',
        TEST_DATABASE_URL:
          'postgresql://test:other@different-host/nestjs_tutorial?host=localhost&port=05432',
      }),
    ).toThrow('TEST_DATABASE_URL must target a different database');
  });

  it('allows a distinct database on the same PostgreSQL server', () => {
    expect(
      getTestDatabaseConfig({
        DATABASE_URL: 'postgresql://app:dev@localhost:5432/nestjs_tutorial',
        TEST_DATABASE_URL:
          'postgresql://test:other@localhost:5432/nestjs_tutorial_test',
      }),
    ).toEqual({
      url: 'postgresql://test:other@localhost:5432/nestjs_tutorial_test',
    });
  });

  it.each([
    [{}, 'TEST_DATABASE_URL is required'],
    [
      { TEST_DATABASE_URL: 'mysql://localhost/app_test' },
      'DATABASE_URL must be PostgreSQL',
    ],
  ])('rejects invalid test database configuration', (environment, message) => {
    expect(() => getTestDatabaseConfig(environment)).toThrow(
      DatabaseConfigValidationError,
    );
    expect(() => getTestDatabaseConfig(environment)).toThrow(message);
  });
});
