import { describe, expect, it, vi } from 'vitest';

import { CreateAttachments1710000003000 } from './1710000003000-create-attachments.js';

describe('CreateAttachments1710000003000', () => {
  it('creates private attachment metadata and its owner index', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateAttachments1710000003000();

    await migration.up({ query } as never);

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('CREATE TABLE "attachments"'),
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('idx_attachments_owner_id'),
    );
  });

  it('removes the attachments table on rollback', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateAttachments1710000003000();

    await migration.down({ query } as never);

    expect(query).toHaveBeenCalledWith('DROP TABLE IF EXISTS "attachments"');
  });
});
