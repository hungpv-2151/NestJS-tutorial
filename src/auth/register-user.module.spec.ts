import { Test, type TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { afterEach, describe, expect, it } from 'vitest';

import { User } from '../users/user.entity.js';
import { RegisterUserModule } from './register-user.module.js';

describe('RegisterUserModule', () => {
  let module: TestingModule | undefined;

  afterEach(async () => {
    await module?.close();
  });

  it('registers User metadata for the registration service', async () => {
    module = await Test.createTestingModule({
      imports: [RegisterUserModule],
    }).compile();

    expect(module.get(DataSource).hasMetadata(User)).toBe(true);
  });
});
