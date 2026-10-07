export function getRedisDatabase(redisUrl: URL): number {
  const path = redisUrl.pathname;
  if (!path || path === '/') return 0;

  const value = path.slice(1);
  if (!/^\d+$/.test(value)) {
    throw new Error('REDIS_URL database path must be a non-negative integer');
  }
  const database = Number(value);
  if (!Number.isSafeInteger(database)) {
    throw new Error(
      'REDIS_URL database path is outside the safe integer range',
    );
  }
  return database;
}
