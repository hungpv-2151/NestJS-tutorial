import { createHash } from 'node:crypto';

import type { OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import {
  AUTH_LOGIN_INCREMENT_SCRIPT,
  AUTH_LOGIN_MAX_ATTEMPTS,
  AUTH_LOGIN_WINDOW_MS,
} from './auth-login-rate-limiter.constants.js';
import type { RedisConnection } from './auth-login-redis-connection.js';

export class AuthLoginRateLimitError extends Error {}

export class AuthLoginRateLimiterConfigError extends Error {}

export class AuthLoginRateLimiter implements OnModuleDestroy {
  private readonly connection: RedisConnection;
  private connectionReady?: Promise<void>;

  constructor(
    environment: NodeJS.ProcessEnv = process.env,
    connection?: RedisConnection,
  ) {
    this.connection = connection ?? createRedisConnection(environment);
  }

  async consume(email: string, ipAddress: string | undefined): Promise<void> {
    await this.connect();
    const keys = [
      createLoginKey('email', email.toLowerCase()),
      createLoginKey('ip', ipAddress ?? 'unknown'),
    ];
    const attempts = await this.connection.eval(
      AUTH_LOGIN_INCREMENT_SCRIPT,
      keys.length,
      ...keys,
      String(AUTH_LOGIN_WINDOW_MS),
    );
    if (!isRateLimited(attempts)) {
      return;
    }
    throw new AuthLoginRateLimitError();
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.connectionReady) {
      return;
    }
    await this.connection.quit();
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
    throw new AuthLoginRateLimiterConfigError('REDIS_URL is required');
  }
  return new Redis(redisUrl, {
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
}

function createLoginKey(type: 'email' | 'ip', value: string): string {
  const hash = createHash('sha256').update(value).digest('hex');
  return `auth:login:${type}:${hash}`;
}

function isRateLimited(attempts: unknown): boolean {
  return (
    Array.isArray(attempts) &&
    attempts.some((attempt) => attempt > AUTH_LOGIN_MAX_ATTEMPTS)
  );
}
