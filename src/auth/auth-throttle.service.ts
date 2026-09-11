import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type Attempt = { count: number; resetAt: number };
const MAX_ATTEMPTS = 10_000;
@Injectable()
export class AuthThrottleService {
  private readonly attempts = new Map<string, Attempt>();
  check(kind: 'login' | 'register', clientAddress: string, account = clientAddress): void {
    const now = Date.now();
    this.evict(now);
    this.record(kind, 'client', clientAddress, now);
    this.record(kind, 'account', account, now);
  }

  private record(kind: 'login' | 'register', scope: 'client' | 'account', key: string, now: number): void {
    this.evict(now);
    const limit = kind === 'login' ? 5 : 3;
    const window = kind === 'login' ? 60_000 : 3_600_000;
    const id = `${kind}:${scope}:${key}`;
    const attempt = this.attempts.get(id);
    if (!attempt || attempt.resetAt <= now) { this.attempts.set(id, { count: 1, resetAt: now + window }); return; }
    if (attempt.count >= limit) throw new HttpException({ errors: { request: ['rate limit exceeded'] } }, HttpStatus.TOO_MANY_REQUESTS);
    attempt.count += 1;
  }

  private evict(now: number): void {
    for (const [key, attempt] of this.attempts) if (attempt.resetAt <= now) this.attempts.delete(key);
    while (this.attempts.size >= MAX_ATTEMPTS) this.attempts.delete(this.attempts.keys().next().value as string);
  }
}
