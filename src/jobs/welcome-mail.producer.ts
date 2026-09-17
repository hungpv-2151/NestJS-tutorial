import { Queue } from 'bullmq';
import type { OnModuleDestroy } from '@nestjs/common';
export const WELCOME_MAIL_QUEUE = 'welcome-mail';
const WELCOME_MAIL_JOB = 'welcome-email';
const REDIS_PROTOCOL = 'redis:';
const REDIS_TLS_PROTOCOL = 'rediss:';
const REDIS_PROTOCOLS = [REDIS_PROTOCOL, REDIS_TLS_PROTOCOL];
export interface WelcomeMailJobData {
  email: string;
  username: string;
}
export interface WelcomeMailQueue {
  add(name: string, data: WelcomeMailJobData): Promise<unknown>;
  close?(): Promise<void>;
}
export type WelcomeMailQueueFactory = () => WelcomeMailQueue;
export interface RedisConnectionOptions {
  db?: number;
  host: string;
  password?: string;
  port: number;
  tls?: Record<string, never>;
  username?: string;
}
export class RedisConnectionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisConnectionConfigError';
  }
}
export class WelcomeMailQueueUnavailableError extends Error {
  constructor() {
    super('Welcome mail queue is unavailable');
    this.name = 'WelcomeMailQueueUnavailableError';
  }
}
export class WelcomeMailProducer implements OnModuleDestroy {
  private queue?: WelcomeMailQueue;
  constructor(private readonly createQueue: WelcomeMailQueueFactory) {}

  async enqueue(user: WelcomeMailJobData): Promise<void> {
    try {
      await this.getQueue().add(WELCOME_MAIL_JOB, user);
    } catch {
      throw new WelcomeMailQueueUnavailableError();
    }
  }
  async onModuleDestroy(): Promise<void> {
    await this.queue?.close?.();
  }
  private getQueue(): WelcomeMailQueue {
    this.queue ??= this.createQueue();
    return this.queue;
  }
}
export function createWelcomeMailQueue(
  connection = getRedisConnectionOptions(),
): WelcomeMailQueue {
  return new Queue<WelcomeMailJobData>(WELCOME_MAIL_QUEUE, {
    connection,
  });
}
export function getRedisConnectionOptions(
  environment: NodeJS.ProcessEnv = process.env,
): RedisConnectionOptions {
  const value = environment.REDIS_URL?.trim();
  if (!value) {
    throw new RedisConnectionConfigError('REDIS_URL is required');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RedisConnectionConfigError('REDIS_URL must be Redis');
  }

  if (!REDIS_PROTOCOLS.includes(url.protocol) || !url.hostname) {
    throw new RedisConnectionConfigError('REDIS_URL must be Redis');
  }

  const db = parseDatabaseNumber(url.pathname);
  const options: RedisConnectionOptions = {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
  };

  if (db !== undefined) {
    options.db = db;
  }
  if (url.username) {
    options.username = decodeURIComponent(url.username);
  }
  if (url.password) {
    options.password = decodeURIComponent(url.password);
  }
  if (url.protocol === REDIS_TLS_PROTOCOL) {
    options.tls = {};
  }

  return options;
}

function parseDatabaseNumber(pathname: string): number | undefined {
  if (!pathname || pathname === '/') {
    return undefined;
  }

  const database = /^\/(\d+)$/.exec(pathname)?.[1];
  if (!database) {
    throw new RedisConnectionConfigError('REDIS_URL must use a numeric database');
  }

  return Number(database);
}
