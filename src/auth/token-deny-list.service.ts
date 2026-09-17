import type { TokenClaims } from './token-claims.js';

export interface TokenDenyListClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<unknown>;
}

export class TokenDenyListUnavailableError extends Error {
  constructor() {
    super('Redis deny-list is unavailable; reject protected requests');
    this.name = 'TokenDenyListUnavailableError';
  }
}

export class TokenDenyListService {
  constructor(
    private readonly client: TokenDenyListClient,
    private readonly now: () => number = Date.now,
  ) {}

  async deny(claims: Pick<TokenClaims, 'exp' | 'jti'>): Promise<void> {
    const ttlSeconds = claims.exp - Math.floor(this.now() / 1_000);
    if (ttlSeconds <= 0) {
      return;
    }

    try {
      await this.client.set(this.key(claims.jti), '1', 'EX', ttlSeconds);
    } catch {
      throw new TokenDenyListUnavailableError();
    }
  }

  async isDenied(tokenId: string): Promise<boolean> {
    try {
      return (await this.client.get(this.key(tokenId))) !== null;
    } catch {
      throw new TokenDenyListUnavailableError();
    }
  }

  private key(tokenId: string): string {
    return `auth:deny-list:${tokenId}`;
  }
}
