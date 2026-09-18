import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { RegisterUserRequestDto } from '../common/dto/user-auth.dto.js';

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
