import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { LoginUserRequestDto, RegisterUserRequestDto } from './user-auth.dto.js';

describe('user auth DTOs', () => {
  it('accepts nested RealWorld registration credentials at their boundaries', async () => {
    const dto = plainToInstance(RegisterUserRequestDto, {
      user: { email: 'reader@example.com', password: 'password', username: 'reader' },
    });

    expect(await validate(dto)).toEqual([]);
  });

  it.each([
    [{ user: { email: 'reader@example.com', password: 'password', username: '' } }],
    [{ user: { email: 'reader@example.com', password: 'password', username: 'u'.repeat(65) } }],
    [{ user: { email: 'invalid', password: 'password', username: 'reader' } }],
    [{ user: { email: 'a'.repeat(250) + '@test.com', password: 'password', username: 'reader' } }],
    [{ user: { email: 'reader@example.com', password: 'short', username: 'reader' } }],
    [{ user: { email: 'reader@example.com', password: 'p'.repeat(129), username: 'reader' } }],
    [{}],
  ])('rejects invalid registration input', async (payload) => {
    expect(await validate(plainToInstance(RegisterUserRequestDto, payload))).not.toEqual([]);
  });

  it('requires nested login credentials', async () => {
    expect(
      await validate(
        plainToInstance(LoginUserRequestDto, {
          user: { email: 'reader@example.com', password: 'password' },
        }),
      ),
    ).toEqual([]);
    expect(await validate(plainToInstance(LoginUserRequestDto, { user: {} }))).not.toEqual([]);
  });
});
