import { describe, expect, it } from 'vitest';

import type { WelcomeMailQueue } from './welcome-mail-queue.js';
import type {
  ClaimedWelcomeMailOutbox,
  WelcomeMailOutboxStore,
} from './welcome-mail-outbox-store.js';
import { WelcomeMailOutboxRelay } from './welcome-mail-outbox-relay.js';

class FakeOutboxStore implements WelcomeMailOutboxStore {
  claimed: ClaimedWelcomeMailOutbox[] = [];
  dispatched: Array<[string, string]> = [];
  markDispatchedError?: Error;
  released: Array<[string, string]> = [];

  async claimReady(): Promise<ClaimedWelcomeMailOutbox[]> {
    return this.claimed;
  }

  async markDispatched(outboxId: string, leaseOwner: string): Promise<void> {
    if (this.markDispatchedError) {
      throw this.markDispatchedError;
    }
    this.dispatched.push([outboxId, leaseOwner]);
  }

  async release(outboxId: string, leaseOwner: string): Promise<void> {
    this.released.push([outboxId, leaseOwner]);
  }
}

class FakeQueue implements WelcomeMailQueue {
  jobs: Parameters<WelcomeMailQueue['add']>[0][] = [];
  addError?: Error;

  async add(job: Parameters<WelcomeMailQueue['add']>[0]): Promise<void> {
    if (this.addError) {
      throw this.addError;
    }
    this.jobs.push(job);
  }

  async close(): Promise<void> {}
}

describe('WelcomeMailOutboxRelay', () => {
  it('uses the outbox id as the idempotent queue job id', async () => {
    const outboxStore = new FakeOutboxStore();
    outboxStore.claimed = [claimedEntry()];
    const queue = new FakeQueue();

    await new WelcomeMailOutboxRelay(outboxStore, queue).relayReady();

    expect(queue.jobs).toEqual([
      {
        email: 'jane@example.com',
        outboxId: claimedEntry().id,
        username: 'jane',
      },
    ]);
    expect(outboxStore.dispatched).toEqual([
      [claimedEntry().id, claimedEntry().leaseOwner],
    ]);
  });

  it('releases the lease when Redis enqueue fails so the next poll retries', async () => {
    const outboxStore = new FakeOutboxStore();
    outboxStore.claimed = [claimedEntry()];
    const queue = new FakeQueue();
    queue.addError = new Error('Redis unavailable');

    await expect(
      new WelcomeMailOutboxRelay(outboxStore, queue).relayReady(),
    ).rejects.toThrow('Welcome-mail enqueue failed');

    expect(outboxStore.dispatched).toEqual([]);
    expect(outboxStore.released).toEqual([
      [claimedEntry().id, claimedEntry().leaseOwner],
    ]);
  });

  it('retains the lease when persisting dispatch status fails after enqueue', async () => {
    const outboxStore = new FakeOutboxStore();
    outboxStore.claimed = [claimedEntry()];
    outboxStore.markDispatchedError = new Error('Database unavailable');
    const queue = new FakeQueue();

    await expect(
      new WelcomeMailOutboxRelay(outboxStore, queue).relayReady(),
    ).rejects.toThrow('Database unavailable');

    expect(queue.jobs).toHaveLength(1);
    expect(outboxStore.released).toEqual([]);
  });
});

function claimedEntry(): ClaimedWelcomeMailOutbox {
  return {
    email: 'jane@example.com',
    id: '420b3f3c-113e-45ea-b5bd-c1dbcbf863ae',
    leaseOwner: '469a5f73-a499-4a33-b67e-2f3a0f547ff3',
    username: 'jane',
  };
}
