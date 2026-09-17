import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RegisterUserController, AUTH_CONFIG } from '../src/auth/register-user.controller.js';
import { configureGlobalRequestHandling } from '../src/create-app.js';
import { UserRegistrationService } from '../src/users/user-registration.service.js';
import { JwtService } from '@nestjs/jwt';

describe('POST /api/users (e2e)', () => {
  let app: INestApplication<App>;

  afterEach(async () => {
    await app?.close();
  });

  it('creates the user and returns the RealWorld response', async () => {
    const register = vi
      .fn()
      .mockResolvedValue({ email: 'jane@example.com', username: 'jane' });
    app = await createApp(register);

    await request(app.getHttpServer())
      .post('/api/users')
      .send({
        user: {
          email: 'jane@example.com',
          password: 'safe-password',
          username: 'jane',
        },
      })
      .expect(201)
      .expect({
        user: {
          bio: null,
          email: 'jane@example.com',
          image: null,
          token: 'signed-token',
          username: 'jane',
        },
      });

    expect(register).toHaveBeenCalledWith({
      email: 'jane@example.com',
      password: 'safe-password',
      username: 'jane',
    });
  });

  it('rejects malformed registration input before persistence', async () => {
    const register = vi.fn();
    app = await createApp(register);

    await request(app.getHttpServer())
      .post('/api/users')
      .send({ user: { email: 'not-an-email', password: 'short', username: '' } })
      .expect(422)
      .expect({
        errors: {
          email: ['is invalid'],
          password: ['is invalid'],
          username: ["can't be blank", 'is invalid'],
        },
      });

    expect(register).not.toHaveBeenCalled();
  });

  it('does not persist a user when token signing fails', async () => {
    const register = vi.fn();
    app = await createApp(register, vi.fn().mockRejectedValue(new Error('signer unavailable')));

    await request(app.getHttpServer())
      .post('/api/users')
      .send({
        user: {
          email: 'jane@example.com',
          password: 'safe-password',
          username: 'jane',
        },
      })
      .expect(500)
      .expect({ errors: { body: ['request failed'] } });

    expect(register).not.toHaveBeenCalled();
  });
});

async function createApp(
  register: ReturnType<typeof vi.fn>,
  signAsync = vi.fn().mockResolvedValue('signed-token'),
): Promise<INestApplication<App>> {
  @Module({
    controllers: [RegisterUserController],
    providers: [
      { provide: UserRegistrationService, useValue: { register } },
      { provide: JwtService, useValue: { signAsync } },
      { provide: AUTH_CONFIG, useValue: { audience: 'client', issuer: 'api', secret: 'secret' } },
    ],
  })
  class RegisterUserTestModule {}

  const module = await Test.createTestingModule({
    imports: [RegisterUserTestModule],
  }).compile();
  const application = module.createNestApplication<App>();
  application.setGlobalPrefix('api');
  configureGlobalRequestHandling(application);
  await application.init();
  return application;
}
