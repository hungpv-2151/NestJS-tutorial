import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';

import {
  WELCOME_MAIL_QUEUE,
  type WelcomeMailQueue,
} from './welcome-mail-queue.js';
import type { WelcomeMailOutboxStore } from './welcome-mail-outbox-store.js';
import {
  POLL_INTERVAL_MS,
  RELAY_BATCH_SIZE,
  WELCOME_MAIL_OUTBOX_RELAY,
} from './welcome-mail-outbox-relay.constants.js';

export { WELCOME_MAIL_OUTBOX_RELAY } from './welcome-mail-outbox-relay.constants.js';

export class WelcomeMailOutboxRelayError extends Error {
  constructor(readonly outboxId: string) {
    super('Welcome-mail enqueue failed');
    this.name = 'WelcomeMailOutboxRelayError';
  }
}

export class WelcomeMailOutboxRelay {
  constructor(
    private readonly outboxStore: WelcomeMailOutboxStore,
    private readonly queue: WelcomeMailQueue,
  ) {}

  async relayReady(): Promise<void> {
    const entries = await this.outboxStore.claimReady(RELAY_BATCH_SIZE);
    for (const entry of entries) {
      try {
        await this.queue.add({
          email: entry.email,
          outboxId: entry.id,
          username: entry.username,
        });
      } catch {
        await this.outboxStore.release(entry.id, entry.leaseOwner);
        throw new WelcomeMailOutboxRelayError(entry.id);
      }
      await this.outboxStore.markDispatched(entry.id, entry.leaseOwner);
    }
  }
}

@Injectable()
export class WelcomeMailOutboxRelayRunner
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(WelcomeMailOutboxRelayRunner.name);
  private relayPromise?: Promise<void>;
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(WELCOME_MAIL_OUTBOX_RELAY)
    private readonly relay: WelcomeMailOutboxRelay,
    @Inject(WELCOME_MAIL_QUEUE)
    private readonly queue: WelcomeMailQueue,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => this.relayOnce(), POLL_INTERVAL_MS);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }
    await this.relayPromise;
    await this.queue.close();
  }

  private relayOnce(): void {
    if (this.relayPromise) {
      return;
    }
    this.relayPromise = this.relay
      .relayReady()
      .catch((error: unknown) => {
        if (error instanceof WelcomeMailOutboxRelayError) {
          this.logger.warn(
            `Welcome-mail enqueue deferred for outbox ${error.outboxId}`,
          );
          return;
        }
        this.logger.error(
          'Welcome-mail relay failed; queued records will retry',
        );
      })
      .finally(() => {
        this.relayPromise = undefined;
      });
  }
}
