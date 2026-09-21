import { afterEach, describe, expect, it, vi } from 'vitest';

describe('data source', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('registers users and follow migrations without schema synchronization', async () => {
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://user:password@localhost:5432/nestjs_tutorial',
    );

    const { default: dataSource } = await import('./data-source.js');

    expect(dataSource.options.entities).toHaveLength(3);
    expect(dataSource.options.migrations).toHaveLength(3);
    expect(dataSource.options.synchronize).toBe(false);
    await expect(dataSource.buildMetadatas()).resolves.toBeUndefined();

    const userMetadata = dataSource.entityMetadatas[0];
    expect(userMetadata.findColumnWithPropertyName('passwordHash')?.length).toBe(
      '255',
    );
    expect(userMetadata.findColumnWithPropertyName('createdAt')?.type).toBe(
      'timestamptz',
    );
    expect(userMetadata.findColumnWithPropertyName('updatedAt')?.type).toBe(
      'timestamptz',
    );
  });
});
