import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, ApiExceptionFilter } from './api-exception.filter.js';

describe('ApiExceptionFilter', () => {
  it('maps validation details into the RealWorld error envelope', () => {
    const status = vi.fn();
    const json = vi.fn();
    status.mockReturnValue({ json });
    const response = { status };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    };
    const exception = new BadRequestException({
      message: ['user.email must be an email'],
    });

    new ApiExceptionFilter().catch(exception, host as never);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith({
      errors: { email: ['must be an email'] },
    });
  });

  it('maps unambiguous Prisma duplicate fields without guessing', () => {
    const status = vi.fn();
    const json = vi.fn();
    status.mockReturnValue({ json });
    const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) };
    const filter = new ApiExceptionFilter();

    filter.catch(new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2002', clientVersion: '6', meta: { target: ['username'] } }), host as never);
    expect(status).toHaveBeenLastCalledWith(409);
    expect(json).toHaveBeenLastCalledWith({ errors: { username: ['has already been taken'] } });

    filter.catch(new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2002', clientVersion: '6', meta: { target: ['users_email_key'] } }), host as never);
    expect(status).toHaveBeenLastCalledWith(409);
    expect(json).toHaveBeenLastCalledWith({ errors: { email: ['has already been taken'] } });

    filter.catch(new Prisma.PrismaClientKnownRequestError('missing', { code: 'P2025', clientVersion: '6' }), host as never);
    expect(status).toHaveBeenLastCalledWith(404);
    expect(json).toHaveBeenLastCalledWith({ errors: { resource: ['not found'] } });
  });

  it.each(['article', 'profile', 'comment'] as const)('preserves an absent %s resource key', (resource) => {
    const status = vi.fn();
    const json = vi.fn();
    status.mockReturnValue({ json });
    const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) };

    new ApiExceptionFilter().catch(ApiError.notFound(resource), host as never);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ errors: { [resource]: ['not found'] } });
  });
});
