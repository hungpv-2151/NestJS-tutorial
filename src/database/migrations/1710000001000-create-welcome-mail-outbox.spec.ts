import { describe, expect, it, vi } from 'vitest';

import { CreateWelcomeMailOutbox1710000001000 } from './1710000001000-create-welcome-mail-outbox.js';

describe('CreateWelcomeMailOutbox1710000001000', () => {
  it('creates a durable outbox with an expiring relay lease', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateWelcomeMailOutbox1710000001000();

    await migration.up({ query } as never);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE "welcome_mail_outbox"'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('"lease_expires_at" TIMESTAMPTZ'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('welcome_mail_outbox_pending_ready_idx'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('welcome_mail_outbox_lease_expired_idx'),
    );
  });

  it('removes the outbox table on rollback', async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    const migration = new CreateWelcomeMailOutbox1710000001000();

    await migration.down({ query } as never);

    expect(query).toHaveBeenCalledWith(
      'DROP TABLE IF EXISTS "welcome_mail_outbox"',
    );
  });
});
