import { describe, expect, it } from 'vitest';
import { getRedisDatabase } from './redis-database.js';

describe('getRedisDatabase', () => {
  it.each([
    ['redis://localhost', 0],
    ['redis://localhost/', 0],
    ['redis://localhost/0', 0],
    ['redis://localhost/12', 12],
  ])('parses database from %s', (value, expected) => {
    expect(getRedisDatabase(new URL(value))).toBe(expected);
  });

  it.each([
    'redis://localhost/name',
    'redis://localhost/-1',
    'redis://localhost/1/2',
  ])('rejects invalid database paths in %s', (value) => {
    expect(() => getRedisDatabase(new URL(value))).toThrow(
      'REDIS_URL database path',
    );
  });
});
