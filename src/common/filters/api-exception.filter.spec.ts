import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  ApiExceptionFilter,
  formatApiException,
} from './api-exception.filter.js';

describe('formatApiException', () => {
  it('returns existing RealWorld errors and their status', () => {
    expect(
      formatApiException(
        new HttpException({ errors: { credentials: ['invalid'] } }, HttpStatus.UNAUTHORIZED),
      ),
    ).toEqual({
      body: { errors: { credentials: ['invalid'] } },
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  });

  it('maps bad requests to RealWorld validation errors', () => {
    expect(
      formatApiException(
        new BadRequestException([
          { constraints: { isNotEmpty: 'username should not be empty' }, property: 'username' },
        ]),
      ),
    ).toEqual({
      body: { errors: { username: ["can't be blank"] } },
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    });
  });

  it('does not disclose unexpected error details', () => {
    expect(formatApiException(new Error('database password leaked'))).toEqual({
      body: { errors: { body: ['internal server error'] } },
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });
});

describe('ApiExceptionFilter', () => {
  it('writes the formatted error without requiring global registration', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const filter = new ApiExceptionFilter();

    filter.catch(new Error('hidden'), { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as never);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({ errors: { body: ['internal server error'] } });
  });
});
