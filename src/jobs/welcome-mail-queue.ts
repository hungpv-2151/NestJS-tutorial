import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { getRedisDatabase } from './redis-database.js';

const DEFAULT_WELCOME_MAIL_QUEUE_NAME = 'welcome-mail';
export const WELCOME_MAIL_QUEUE = Symbol('WELCOME_MAIL_QUEUE');

export interface WelcomeMailJob {
  email: string;
  outboxId: string;
  username: string;
}

export interface WelcomeMailQueue {
  add(job: WelcomeMailJob): Promise<void>;
  close(): Promise<void>;
}

export class RedisConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisConfigValidationError';
  }
}

export class BullMqWelcomeMailQueue implements WelcomeMailQueue {
  private readonly connection: Redis;
  private hasAddedJob = false;
  private readonly queue: Queue<WelcomeMailJob>;

  constructor(environment: NodeJS.ProcessEnv = process.env) {
    const redisUrl = getRedisUrl(environment);
    const queueName =
      environment.WELCOME_MAIL_QUEUE_NAME?.trim() ||
      DEFAULT_WELCOME_MAIL_QUEUE_NAME;
    this.connection = new Redis({
      enableOfflineQueue: false,
      db: getRedisDatabase(redisUrl),
      host: redisUrl.hostname,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      password: decodeURIComponent(redisUrl.password),
      port: Number(redisUrl.port || 6379),
      tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
      username: decodeURIComponent(redisUrl.username),
    });
    this.queue = new Queue(queueName, {
      connection: this.connection,
    });
  }

  async add(job: WelcomeMailJob): Promise<void> {
    this.hasAddedJob = true;
    await this.queue.add('send-welcome-mail', job, {
      jobId: job.outboxId,
      removeOnComplete: false,
    });
  }

  async close(): Promise<void> {
    if (this.hasAddedJob) {
      await this.queue.close();
      await this.connection.quit();
    }
  }
}

function getRedisUrl(environment: NodeJS.ProcessEnv): URL {
  const value = environment.REDIS_URL?.trim();
  if (!value) {
    throw new RedisConfigValidationError('REDIS_URL is required');
  }
  if (!URL.canParse(value)) {
    throw new RedisConfigValidationError('REDIS_URL must be a Redis URL');
  }

  const redisUrl = new URL(value);
  if (
    !['redis:', 'rediss:'].includes(redisUrl.protocol) ||
    !redisUrl.hostname ||
    !redisUrl.username ||
    !redisUrl.password
  ) {
    throw new RedisConfigValidationError(
      'REDIS_URL must include credentials and host',
    );
  }
  return redisUrl;
}
