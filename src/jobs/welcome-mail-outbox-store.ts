import { randomUUID } from 'node:crypto';

import { DataSource } from 'typeorm';

import { WelcomeMailOutbox } from './welcome-mail-outbox.entity.js';

const LEASE_DURATION_MS = 30_000;
export const WELCOME_MAIL_OUTBOX_STORE = Symbol('WELCOME_MAIL_OUTBOX_STORE');

export interface ClaimedWelcomeMailOutbox {
  email: string;
  id: string;
  leaseOwner: string;
  username: string;
}

export interface WelcomeMailOutboxStore {
  claimReady(limit: number): Promise<ClaimedWelcomeMailOutbox[]>;
  markDispatched(outboxId: string, leaseOwner: string): Promise<void>;
  release(outboxId: string, leaseOwner: string): Promise<void>;
}

export class TypeOrmWelcomeMailOutboxStore implements WelcomeMailOutboxStore {
  constructor(private readonly dataSource: DataSource) {}

  async claimReady(limit: number): Promise<ClaimedWelcomeMailOutbox[]> {
    const leaseOwner = randomUUID();
    const leaseExpiresAt = new Date(Date.now() + LEASE_DURATION_MS);

    return this.dataSource.transaction(async (manager) => {
      const entries = await manager
        .getRepository(WelcomeMailOutbox)
        .createQueryBuilder('outbox')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('outbox.dispatched_at IS NULL')
        .andWhere('outbox.available_at <= now()')
        .andWhere(
          '(outbox.lease_expires_at IS NULL OR outbox.lease_expires_at <= now())',
        )
        .orderBy('outbox.created_at', 'ASC')
        .take(limit)
        .getMany();

      for (const entry of entries) {
        entry.attemptCount += 1;
        entry.leaseOwner = leaseOwner;
        entry.leaseExpiresAt = leaseExpiresAt;
        entry.status = 'dispatching';
      }
      await manager.save(entries);
      return entries.map((entry) => ({
        email: entry.email,
        id: entry.id,
        leaseOwner,
        username: entry.username,
      }));
    });
  }

  async markDispatched(outboxId: string, leaseOwner: string): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(WelcomeMailOutbox)
      .set({
        dispatchedAt: new Date(),
        leaseExpiresAt: null,
        leaseOwner: null,
        status: 'dispatched',
      })
      .where('id = :outboxId AND lease_owner = :leaseOwner', {
        leaseOwner,
        outboxId,
      })
      .execute();
  }

  async release(outboxId: string, leaseOwner: string): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(WelcomeMailOutbox)
      .set({
        availableAt: new Date(),
        leaseExpiresAt: null,
        leaseOwner: null,
        status: 'pending',
      })
      .where('id = :outboxId AND lease_owner = :leaseOwner', {
        leaseOwner,
        outboxId,
      })
      .execute();
  }
}
