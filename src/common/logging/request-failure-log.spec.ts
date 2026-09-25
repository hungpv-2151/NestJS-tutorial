import { describe, expect, it } from 'vitest';

import { createRequestFailureLog } from './request-failure-log.js';

describe('createRequestFailureLog', () => {
  it('records failure details while redacting sensitive request fields', () => {
    expect(
      createRequestFailureLog(new Error('database unavailable'), {
        body: {
          email: 'jane@example.com',
          password: 'safe-password',
          user: {
            email: 'jane@example.com',
            passwordHash: 'hash',
            username: 'jane',
          },
        },
        method: 'POST',
        path: '/api/users',
        query: { token: 'secret-token' },
      }),
    ).toMatchObject({
      error: { category: 'Error' },
      request: {
        body: {
          email: '[REDACTED]',
          password: '[REDACTED]',
          user: {
            email: '[REDACTED]',
            passwordHash: '[REDACTED]',
            username: '[REDACTED]',
          },
        },
        method: 'POST',
        path: '/api/users',
        query: { token: '[REDACTED]' },
      },
    });
    expect(createRequestFailureLog(new Error('failed'), {}).occurredAt).toEqual(
      expect.any(String),
    );
  });

  it('does not log untrusted error-message content', () => {
    const log = createRequestFailureLog(
      new Error(
        String.raw`database failed: password="plain\"text", passwordHash='hash\'value', token=token-value, authorization: Bearer jwt-value, cookie="session\"value"`,
      ),
      undefined,
    );

    expect(log.error).toEqual({
      category: 'Error',
    });
  });

  it('does not log unstructured credentials embedded in error messages', () => {
    const log = createRequestFailureLog(
      new Error('database failed: password correct horse battery staple'),
      undefined,
    );

    expect(log.error).toEqual({
      category: 'Error',
    });
  });

  it('does not trust a mutable error name', () => {
    const error = new Error();
    error.name = 'password correct horse battery staple';

    expect(createRequestFailureLog(error, undefined).error).toEqual({
      category: 'Error',
    });
  });
});
