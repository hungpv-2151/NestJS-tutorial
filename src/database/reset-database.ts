interface ResettableDataSource {
  initialize(): Promise<unknown>;
  dropDatabase(): Promise<void>;
  runMigrations(): Promise<unknown>;
  destroy(): Promise<void>;
}

export async function runDatabaseReset(
  dataSource: ResettableDataSource,
  validateReset: () => unknown,
): Promise<void> {
  validateReset();

  let isInitialized = false;
  try {
    await dataSource.initialize();
    isInitialized = true;
    await dataSource.dropDatabase();
    await dataSource.runMigrations();
  } finally {
    if (isInitialized) {
      await dataSource.destroy();
    }
  }
}
