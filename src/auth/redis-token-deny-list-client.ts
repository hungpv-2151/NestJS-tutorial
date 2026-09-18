import type { OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import type { TokenDenyListClient } from './token-deny-list.service.js';

interface RedisConnection extends TokenDenyListClient {
  connect(): Promise<unknown>;
  quit(): Promise<unknown>;
}

export class TokenDenyListConfigError extends Error {}

export class RedisTokenDenyListClient
  implements TokenDenyListClient, OnModuleDestroy
{
  private readonly connection: RedisConnection;
  private connectionReady?: Promise<void>;

  constructor(
    environment: NodeJS.ProcessEnv = process.env,
    connection?: RedisConnection,
  ) {
    this.connection = connection ?? createRedisConnection(environment);
  }

  async get(key: string): Promise<string | null> {
    await this.connect();
    return this.connection.get(key);
  }

  async set(
    key: string,
    value: string,
    mode: 'EX',
    ttlSeconds: number,
  ): Promise<unknown> {
    await this.connect();
    return this.connection.set(key, value, mode, ttlSeconds);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connectionReady) {
      await this.connection.quit();
    }
  }

  private async connect(): Promise<void> {
    this.connectionReady ??= this.connection.connect().then(() => undefined);
    try {
      await this.connectionReady;
    } catch (error) {
      this.connectionReady = undefined;
      throw error;
    }
  }
}

function createRedisConnection(environment: NodeJS.ProcessEnv): RedisConnection {
  const redisUrl = environment.REDIS_URL?.trim();
  if (!redisUrl) {
    throw new TokenDenyListConfigError('REDIS_URL is required');
  }
  return new Redis(redisUrl, {
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
}
