import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

type ErrorKey = 'article' | 'comment' | 'email' | 'profile' | 'username';
type NotFoundResource = Extract<ErrorKey, 'article' | 'comment' | 'profile'>;
type DuplicateField = Extract<ErrorKey, 'email' | 'username'>;
const validationFields = new Set(['username', 'email', 'password', 'title', 'description', 'body', 'tagList']);

const prismaUniqueFields = new Map<string, DuplicateField>([
  ['username', 'username'],
  ['email', 'email'],
  ['users_username_key', 'username'],
  ['users_email_key', 'email'],
]);

export class ApiError extends HttpException {
  private constructor(status: HttpStatus, key: ErrorKey, message: string) {
    super({ errors: { [key]: [message] } }, status);
  }

  static duplicate(field: DuplicateField): ApiError {
    return new ApiError(HttpStatus.CONFLICT, field, 'has already been taken');
  }

  static notFound(resource: NotFoundResource): ApiError {
    return new ApiError(HttpStatus.NOT_FOUND, resource, 'not found');
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const result = this.toResponse(exception);
    response.status(result.status).json({ errors: result.errors });
  }

  private toResponse(exception: unknown): { status: number; errors: Record<string, string[]> } {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') return this.fromPrismaUniqueViolation(exception);
      if (exception.code === 'P2025') return { status: HttpStatus.NOT_FOUND, errors: { resource: ['not found'] } };
    }
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      const detail = typeof payload === 'string' ? { message: payload } : payload as Record<string, unknown>;
      return { status: exception.getStatus() === HttpStatus.BAD_REQUEST ? HttpStatus.UNPROCESSABLE_ENTITY : exception.getStatus(), errors: this.toErrors(detail) };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, errors: { server: ['internal error'] } };
  }

  private fromPrismaUniqueViolation(exception: Prisma.PrismaClientKnownRequestError): { status: number; errors: Record<string, string[]> } {
    const target = exception.meta?.target;
    const name = Array.isArray(target) && target.length === 1 && typeof target[0] === 'string'
      ? target[0]
      : typeof target === 'string' ? target : undefined;
    const field = name ? prismaUniqueFields.get(name) : undefined;
    return field
      ? { status: HttpStatus.CONFLICT, errors: { [field]: ['has already been taken'] } }
      : { status: HttpStatus.CONFLICT, errors: { resource: ['has already been taken'] } };
  }

  private toErrors(payload: Record<string, unknown>): Record<string, string[]> {
    if (this.isErrors(payload.errors)) return payload.errors;

    const messages = Array.isArray(payload.message) ? payload.message : [payload.message];
    return messages.reduce<Record<string, string[]>>((errors, message) => {
      if (typeof message !== 'string') return errors;
      const [field, ...parts] = message.split(' ');
      const key = this.validationKey(field, message);
      errors[key] = [parts.join(' ') || 'is invalid'];
      return errors;
    }, {});
  }

  private validationKey(field: string, message: string): string {
    const segments = field.replace(/[\[\]]/g, '.').split('.').filter(Boolean);
    const known = [...segments].reverse().find((segment) => validationFields.has(segment));
    if (known) return known;
    const match = /\b(username|email|password|title|description|body|tagList)\b/.exec(message);
    return match?.[1] ?? segments.at(-1) ?? 'request';
  }

  private isErrors(value: unknown): value is Record<string, string[]> {
    return typeof value === 'object' && value !== null && Object.values(value).every(
      (entry) => Array.isArray(entry) && entry.every((message) => typeof message === 'string'),
    );
  }
}
