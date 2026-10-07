import { Queue } from 'bullmq';
import { getRedisDatabase } from '../src/jobs/redis-database.js';

export async function removeTestWelcomeMailQueue(queueName: string) {
  if (!queueName.startsWith('welcome-mail-c2-')) {
    throw new Error('Refusing to remove a non-C2 welcome-mail queue');
  }
  const redisUrl = getRedisUrl();
  const queue = new Queue(queueName, {
    connection: {
      db: getRedisDatabase(redisUrl),
      host: redisUrl.hostname,
      password: decodeURIComponent(redisUrl.password),
      port: Number(redisUrl.port || 6379),
      tls: redisUrl.protocol === 'rediss:' ? {} : undefined,
      username: decodeURIComponent(redisUrl.username),
    },
  });
  try {
    await queue.obliterate({ force: true });
  } finally {
    await queue.close();
  }
}

function getRedisUrl(): URL {
  const value = process.env.REDIS_URL?.trim();
  if (!value || !URL.canParse(value)) {
    throw new Error('REDIS_URL must be set for the C2 test queue cleanup');
  }
  const redisUrl = new URL(value);
  if (
    !['redis:', 'rediss:'].includes(redisUrl.protocol) ||
    !redisUrl.hostname ||
    !redisUrl.username ||
    !redisUrl.password
  ) {
    throw new Error(
      'REDIS_URL must include Redis protocol, host, and credentials',
    );
  }
  return redisUrl;
}
