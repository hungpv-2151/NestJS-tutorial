import { describe, expect, it, vi } from 'vitest';
import { runDatabaseReset } from './reset-database.js';
import { getDatabaseResetConfig } from './database-reset-config.js';

function createDataSource() {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    dropDatabase: vi.fn().mockResolvedValue(undefined),
    runMigrations: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

describe('runDatabaseReset', () => {
  it('refuses before initializing or dropping an unconfirmed database', async () => {
    const dataSource = createDataSource();

    await expect(
      runDatabaseReset(dataSource, () =>
        getDatabaseResetConfig({
          TEST_DATABASE_URL:
            'postgresql://user:password@localhost:5432/nestjs_tutorial_test',
        }),
      ),
    ).rejects.toThrow('Set CONFIRM_DATABASE_RESET=yes');

    expect(dataSource.initialize).not.toHaveBeenCalled();
    expect(dataSource.dropDatabase).not.toHaveBeenCalled();
    expect(dataSource.runMigrations).not.toHaveBeenCalled();
    expect(dataSource.destroy).not.toHaveBeenCalled();
  });

  it('initializes, drops, migrates, then destroys the test database', async () => {
    const dataSource = createDataSource();

    await runDatabaseReset(dataSource, () => ({ url: 'test-url' }));

    expect(dataSource.initialize).toHaveBeenCalledBefore(dataSource.dropDatabase);
    expect(dataSource.dropDatabase).toHaveBeenCalledBefore(
      dataSource.runMigrations,
    );
    expect(dataSource.runMigrations).toHaveBeenCalledBefore(dataSource.destroy);
  });

  it('destroys the data source when migration fails', async () => {
    const dataSource = createDataSource();
    dataSource.runMigrations.mockRejectedValueOnce(new Error('migration failed'));

    await expect(
      runDatabaseReset(dataSource, () => ({ url: 'test-url' })),
    ).rejects.toThrow('migration failed');

    expect(dataSource.destroy).toHaveBeenCalledOnce();
  });
});
