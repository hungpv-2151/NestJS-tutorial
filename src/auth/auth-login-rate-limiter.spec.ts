import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  AuthLoginRateLimiter,
  AuthLoginRateLimitError,
} from './auth-login-rate-limiter.js';

class FakeRedisConnection {
  private readonly attempts = new Map<string, number>();

  async connect(): Promise<void> {}

  async eval(
    _script: string,
    numberOfKeys: number,
    ...args: string[]
  ): Promise<number[]> {
    return args.slice(0, numberOfKeys).map((key) => {
      const attempts = (this.attempts.get(key) ?? 0) + 1;
      this.attempts.set(key, attempts);
      return attempts;
    });
  }

  async quit(): Promise<void> {}
}

describe('AuthLoginRateLimiter', () => {
  it('limits one account across IP addresses', async () => {
    const limiter = new AuthLoginRateLimiter({}, new FakeRedisConnection());

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await limiter.consume('jane@example.com', '127.0.0.1');
    }

    await expect(
      limiter.consume('jane@example.com', '127.0.0.2'),
    ).rejects.toBeInstanceOf(AuthLoginRateLimitError);
  });

  it('limits one IP address across accounts', async () => {
    const limiter = new AuthLoginRateLimiter({}, new FakeRedisConnection());

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await limiter.consume(`user-${attempt}@example.com`, '127.0.0.1');
    }

    await expect(
      limiter.consume('jane@example.com', '127.0.0.1'),
    ).rejects.toBeInstanceOf(AuthLoginRateLimitError);
  });

  const integration = process.env.REDIS_URL ? it : it.skip;

  integration('uses Redis to limit login attempts across processes', async () => {
    const firstLimiter = new AuthLoginRateLimiter();
    const secondLimiter = new AuthLoginRateLimiter();
    const identifier = randomUUID();
    const email = `rate-limit-${identifier}@example.com`;
    const ipAddress = `test-${identifier}`;

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await firstLimiter.consume(email, ipAddress);
      }

      await expect(
        secondLimiter.consume(email, ipAddress),
      ).rejects.toBeInstanceOf(AuthLoginRateLimitError);
    } finally {
      await firstLimiter.onModuleDestroy();
      await secondLimiter.onModuleDestroy();
    }
  });
});
