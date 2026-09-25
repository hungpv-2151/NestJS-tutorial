import { Test, type TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { afterEach, describe, expect, it } from 'vitest';

import { User } from '../users/user.entity.js';
import { AuthModule } from './auth.module.js';

describe('AuthModule', () => {
  let module: TestingModule | undefined;

  afterEach(async () => {
    await module?.close();
  });

  it('registers User metadata for the registration service', async () => {
    module = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    expect(module.get(DataSource).hasMetadata(User)).toBe(true);
  });
});
