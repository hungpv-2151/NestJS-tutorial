import { afterEach, describe, expect, it, vi } from 'vitest';

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalDatabaseEnabled = process.env.DATABASE_ENABLED;

afterEach(() => {
  vi.resetModules();
  restoreEnvironment('DATABASE_URL', originalDatabaseUrl);
  restoreEnvironment('DATABASE_ENABLED', originalDatabaseEnabled);
});

describe('AppModule database configuration', () => {
  it('does not register the database module without explicit enablement', async () => {
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/app_dev';
    delete process.env.DATABASE_ENABLED;

    const { AppModule } = await import('./app.module.js');

    expect(Reflect.getMetadata('imports', AppModule)).toHaveLength(1);
  });

  it.each([
    [undefined, 'DATABASE_URL is required'],
    ['mysql://localhost/app_dev', 'DATABASE_URL must be PostgreSQL'],
  ])('rejects %s database configuration when enabled', async (url, message) => {
    process.env.DATABASE_ENABLED = 'true';
    if (url === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = url;
    }

    await expect(import('./app.module.js')).rejects.toThrow(message);
  });

  it('registers the database module with a valid enabled database URL', async () => {
    process.env.DATABASE_ENABLED = 'true';
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/app_dev';

    const { AppModule } = await import('./app.module.js');

    expect(Reflect.getMetadata('imports', AppModule)).toHaveLength(2);
  });
});

function restoreEnvironment(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
