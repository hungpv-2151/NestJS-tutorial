import { afterEach, describe, expect, it, vi } from 'vitest';

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  vi.resetModules();
  restoreEnvironment('DATABASE_URL', originalDatabaseUrl);
});

describe('AppModule database configuration', () => {
  it('always registers the database module with a valid database URL', async () => {
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/app_dev';

    const { AppModule } = await import('./app.module.js');

    expect(Reflect.getMetadata('imports', AppModule)).toHaveLength(5);
  });

  it.each([
    [undefined, 'DATABASE_URL is required'],
    ['mysql://localhost/app_dev', 'DATABASE_URL must be PostgreSQL'],
  ])('rejects %s database configuration', async (url, message) => {
    if (url === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = url;
    }

    await expect(import('./app.module.js')).rejects.toThrow(message);
  });
});

function restoreEnvironment(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
