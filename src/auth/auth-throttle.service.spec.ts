import { HttpException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthThrottleService } from './auth-throttle.service.js';

describe('AuthThrottleService', () => {
  it('limits login attempts independently by account and client address', () => {
    const throttle = new AuthThrottleService();
    for (let attempt = 0; attempt < 5; attempt += 1) throttle.check('login', '127.0.0.1:user@example.com');
    expect(() => throttle.check('login', '127.0.0.1:user@example.com')).toThrow(HttpException);
    expect(() => throttle.check('login', '127.0.0.1:other@example.com')).not.toThrow();
  });

  it('limits distinct accounts sharing one client address', () => {
    const throttle = new AuthThrottleService();
    for (let attempt = 0; attempt < 3; attempt += 1) throttle.check('register', '127.0.0.1', `user-${attempt}@example.com`);
    expect(() => throttle.check('register', '127.0.0.1', 'user-3@example.com')).toThrow(HttpException);
  });

  it('evicts expired entries before enforcing the cap', () => {
    vi.useFakeTimers();
    try {
      const throttle = new AuthThrottleService();
      throttle.check('register', '127.0.0.1', 'expired@example.com');
      vi.advanceTimersByTime(3_600_001);
      expect(() => throttle.check('register', '127.0.0.1', 'fresh@example.com')).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });
});
