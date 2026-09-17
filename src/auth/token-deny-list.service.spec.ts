import { describe, expect, it, vi } from 'vitest';
import {
  TokenDenyListService,
  TokenDenyListUnavailableError,
} from './token-deny-list.service.js';

describe('TokenDenyListService', () => {
  it('stores a token id for exactly its remaining whole-second lifetime', async () => {
    const redis = { get: vi.fn(), set: vi.fn().mockResolvedValue('OK') };
    const service = new TokenDenyListService(redis, () => 1_000_000);

    await service.deny({ exp: 1_901, jti: 'token-id' });

    expect(redis.set).toHaveBeenCalledWith('auth:deny-list:token-id', '1', 'EX', 901);
  });

  it('does not write a deny-list entry for an already expired token', async () => {
    const redis = { get: vi.fn(), set: vi.fn() };
    const service = new TokenDenyListService(redis, () => 1_000_000);

    await service.deny({ exp: 1_000, jti: 'expired-token' });

    expect(redis.set).not.toHaveBeenCalled();
  });

  it('returns whether the token id is deny-listed', async () => {
    const redis = { get: vi.fn().mockResolvedValue('1'), set: vi.fn() };
    const service = new TokenDenyListService(redis);

    await expect(service.isDenied('token-id')).resolves.toBe(true);
  });

  it('fails closed when Redis is unavailable', async () => {
    const redis = { get: vi.fn().mockRejectedValue(new Error('offline')), set: vi.fn() };
    const service = new TokenDenyListService(redis);

    await expect(service.isDenied('token-id')).rejects.toThrow(TokenDenyListUnavailableError);
  });

  it('fails closed when Redis cannot record a revoked token', async () => {
    const redis = { get: vi.fn(), set: vi.fn().mockRejectedValue(new Error('offline')) };
    const service = new TokenDenyListService(redis, () => 1_000_000);

    await expect(service.deny({ exp: 1_901, jti: 'token-id' })).rejects.toThrow(
      TokenDenyListUnavailableError,
    );
  });
});
