import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { LoginUserDto, UpdateUserDto } from './user.dto.js';

describe('user DTO metadata initialization', () => {
  it('constructs nested login and update DTOs at module load', async () => {
    const login = plainToInstance(LoginUserDto, { user: { email: 'user@example.com', password: 'password123' } });
    const update = plainToInstance(UpdateUserDto, { user: { bio: 'updated' } });

    await expect(validate(login)).resolves.toEqual([]);
    await expect(validate(update)).resolves.toEqual([]);
  });
});
