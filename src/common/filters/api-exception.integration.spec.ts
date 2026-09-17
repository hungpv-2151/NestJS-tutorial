import 'reflect-metadata';
import { Body, Controller, type INestApplication, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { configureGlobalRequestHandling } from '../../create-app.js';
import { RegisterUserRequestDto } from '../dto/user-auth.dto.js';

@Controller('users')
class ValidationTestController {
  @Post()
  create(@Body() requestDto: RegisterUserRequestDto): RegisterUserRequestDto {
    return requestDto;
  }
}

@Module({ controllers: [ValidationTestController] })
class ValidationTestModule {}

describe('global request handling', () => {
  let app: INestApplication;

  afterEach(() => app?.close());

  it('formats nested DTO validation errors as RealWorld 422 errors', async () => {
    app = await NestFactory.create(ValidationTestModule, { logger: false });
    configureGlobalRequestHandling(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .post('/users')
      .send({ user: { email: '', password: '', username: '' } })
      .expect(422);

    for (const field of ['email', 'password', 'username']) {
      expect(response.body.errors[field][0]).toBe("can't be blank");
    }
    expect(response.body.errors).not.toHaveProperty('user.username');
  });
});
