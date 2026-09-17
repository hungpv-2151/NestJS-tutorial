import { describe, expect, it, vi } from 'vitest';

import {
  getRedisConnectionOptions,
  WelcomeMailProducer,
  WelcomeMailQueueUnavailableError,
  type WelcomeMailQueue,
} from './welcome-mail.producer.js';

describe('getRedisConnectionOptions', () => {
  it('parses a Redis URL into BullMQ connection options', () => {
    expect(
      getRedisConnectionOptions({
        REDIS_URL: 'rediss://user:password@redis.example.com:6380/3',
      }),
    ).toEqual({
      db: 3,
      host: 'redis.example.com',
      password: 'password',
      port: 6380,
      tls: {},
      username: 'user',
    });
  });

  it.each([
    [undefined, 'REDIS_URL is required'],
    ['postgresql://localhost/app', 'REDIS_URL must be Redis'],
    ['redis://', 'REDIS_URL must be Redis'],
  ])('rejects invalid Redis configuration without exposing its value', (url, message) => {
    const environment = url === undefined ? {} : { REDIS_URL: url };

    expect(() => getRedisConnectionOptions(environment)).toThrow(message);
    expect(() => getRedisConnectionOptions(environment)).not.toThrow(String(url));
  });
});

describe('WelcomeMailProducer', () => {
  it('adds a welcome job with persisted user data', async () => {
    const queue: WelcomeMailQueue = { add: vi.fn().mockResolvedValue(undefined) };
    const producer = new WelcomeMailProducer(() => queue);

    await producer.enqueue({ email: 'jane@example.com', username: 'jane' });

    expect(queue.add).toHaveBeenCalledWith('welcome-email', {
      email: 'jane@example.com',
      username: 'jane',
    });
  });

  it('converts queue failures to an opaque availability error', async () => {
    const queue: WelcomeMailQueue = {
      add: vi.fn().mockRejectedValue(new Error('redis://secret@internal:6379 refused')),
    };
    const producer = new WelcomeMailProducer(() => queue);

    await expect(
      producer.enqueue({ email: 'jane@example.com', username: 'jane' }),
    ).rejects.toBeInstanceOf(WelcomeMailQueueUnavailableError);
  });

});
