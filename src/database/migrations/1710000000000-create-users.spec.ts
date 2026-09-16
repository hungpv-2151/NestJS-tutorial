import { describe, expect, it, vi } from 'vitest';
import { CreateUsers1710000000000 } from './1710000000000-create-users.js';

describe('CreateUsers1710000000000', () => {
  it('creates the users table and its UUID extension', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateUsers1710000000000();

    await migration.up({ query } as never);

    expect(query).toHaveBeenNthCalledWith(
      1,
      'CREATE EXTENSION IF NOT EXISTS "pgcrypto"',
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('CREATE TABLE "users"'),
    );
  });

  it('removes the users table on rollback', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateUsers1710000000000();

    await migration.down({ query } as never);

    expect(query).toHaveBeenCalledWith('DROP TABLE IF EXISTS "users"');
  });
});
