import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { describe, expect, it } from 'vitest';
import { RedisTokenDenyListClient } from '../src/auth/redis-token-deny-list-client.js';
import { TokenDenyListService } from '../src/auth/token-deny-list.service.js';

const redisUrl =
  process.env.TEST_REDIS_URL?.trim() || process.env.REDIS_URL?.trim();
const itWithRedis = redisUrl ? it : it.skip;

describe('Redis token deny-list integration', () => {
  itWithRedis(
    'stores an entry with a bounded expiry and reads it back',
    async () => {
      const tokenId = `integration:${randomUUID()}`;
      const key = `auth:deny-list:${tokenId}`;
      const client = new RedisTokenDenyListClient({ REDIS_URL: redisUrl });
      const service = new TokenDenyListService(client, () => 1_000_000);
      const cleanupConnection = new Redis(redisUrl, { lazyConnect: true });

      try {
        await cleanupConnection.connect();
        await service.deny({ exp: 1_030, jti: tokenId });
        expect(await service.isDenied(tokenId)).toBe(true);
        const remainingSeconds = await cleanupConnection.ttl(key);
        expect(remainingSeconds).toBeGreaterThan(0);
        expect(remainingSeconds).toBeLessThanOrEqual(30);
      } finally {
        try {
          await client.onModuleDestroy();
        } finally {
          try {
            if (cleanupConnection.status === 'ready') {
              await cleanupConnection.del(key);
            }
          } finally {
            await cleanupConnection.quit();
          }
        }
      }
    },
    10_000,
  );
});
