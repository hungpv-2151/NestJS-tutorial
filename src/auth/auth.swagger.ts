import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import {
  LoginUserRequestDto,
  RegisterUserRequestDto,
} from '../common/dto/user-auth.dto.js';

const AUTHENTICATED_USER_SCHEMA = {
  example: {
    user: {
      bio: null,
      email: 'jane@example.com',
      image: null,
      token: 'jwt-token',
      username: 'jane',
    },
  },
  properties: {
    user: {
      properties: {
        bio: { nullable: true, type: 'string' },
        email: { format: 'email', type: 'string' },
        image: { nullable: true, type: 'string' },
        token: { type: 'string' },
        username: { type: 'string' },
      },
      required: ['email', 'username', 'bio', 'image', 'token'],
      type: 'object',
    },
  },
  required: ['user'],
  type: 'object',
};

const VALIDATION_ERROR_SCHEMA = {
  example: { errors: { email: ['is invalid'] } },
  type: 'object',
};

export function RegisterUserSwagger(): MethodDecorator {
  return applyDecorators(
    ApiTags('Authentication'),
    ApiOperation({ summary: 'Register a new user' }),
    ApiBody({ type: RegisterUserRequestDto }),
    ApiCreatedResponse({
      description: 'User created.',
      schema: AUTHENTICATED_USER_SCHEMA,
    }),
    ApiConflictResponse({
      description: 'Email or username is already taken.',
      schema: VALIDATION_ERROR_SCHEMA,
    }),
    ApiUnprocessableEntityResponse({
      description: 'Request validation failed.',
      schema: VALIDATION_ERROR_SCHEMA,
    }),
    ApiInternalServerErrorResponse({
      description: 'Registration could not be completed.',
      schema: VALIDATION_ERROR_SCHEMA,
    }),
  );
}

export function LoginUserSwagger(): MethodDecorator {
  return applyDecorators(
    ApiTags('Authentication'),
    ApiOperation({ summary: 'Sign in with email and password' }),
    ApiBody({ type: LoginUserRequestDto }),
    ApiOkResponse({
      description: 'Authenticated user.',
      schema: AUTHENTICATED_USER_SCHEMA,
    }),
    ApiUnauthorizedResponse({
      description: 'Credentials are invalid.',
      schema: VALIDATION_ERROR_SCHEMA,
    }),
    ApiTooManyRequestsResponse({
      description: 'Too many login attempts.',
      schema: VALIDATION_ERROR_SCHEMA,
    }),
    ApiUnprocessableEntityResponse({
      description: 'Request validation failed.',
      schema: VALIDATION_ERROR_SCHEMA,
    }),
    ApiInternalServerErrorResponse({
      description: 'Login could not be completed.',
      schema: VALIDATION_ERROR_SCHEMA,
    }),
  );
}

export function CurrentUserSwagger(): MethodDecorator {
  return applyDecorators(
    ApiTags('Authentication'),
    ApiOperation({ summary: 'Get the authenticated user' }),
    ApiHeader({
      description: 'JWT presented as Token <jwt>.',
      name: 'Authorization',
      required: true,
    }),
    ApiOkResponse({
      description: 'Authenticated user.',
      schema: AUTHENTICATED_USER_SCHEMA,
    }),
    ApiUnauthorizedResponse({
      description: 'Token is missing or invalid.',
      schema: VALIDATION_ERROR_SCHEMA,
    }),
  );
}
