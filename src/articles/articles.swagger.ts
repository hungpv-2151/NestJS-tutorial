import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiSecurity,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { TOKEN_AUTH_SECURITY_SCHEME } from '../auth/auth.swagger.js';
import { CreateArticleRequestDto } from './article-create.dto.js';

const AUTH_ERROR_SCHEMA = {
  example: { errors: { token: ['is missing'] } },
  type: 'object',
};
const CONFLICT_ERROR_SCHEMA = {
  example: { errors: { slug: ['has already been taken'] } },
  type: 'object',
};
const VALIDATION_ERROR_SCHEMA = {
  example: { errors: { title: ["can't be blank"] } },
  type: 'object',
};
const CREATED_ARTICLE_SCHEMA = {
  example: {
    article: {
      author: { bio: null, following: false, image: null, username: 'jane' },
      body: 'Article body',
      createdAt: '2026-09-28T00:00:00.000Z',
      description: 'Description',
      favorited: false,
      favoritesCount: 0,
      slug: 'article-uuid',
      tagList: ['nestjs'],
      title: 'Article',
      updatedAt: '2026-09-28T00:00:00.000Z',
    },
  },
  type: 'object',
};

export function CreateArticleSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: 'Create an article' }),
    ApiHeader({
      description: 'JWT presented as Token <jwt>.',
      example: 'Token <jwt>',
      name: 'Authorization',
      required: true,
    }),
    ApiSecurity(TOKEN_AUTH_SECURITY_SCHEME),
    ApiBody({ type: CreateArticleRequestDto }),
    ApiCreatedResponse({
      description: 'Article created.',
      schema: CREATED_ARTICLE_SCHEMA,
    }),
    ApiUnauthorizedResponse({
      description: 'Token is missing or invalid.',
      schema: AUTH_ERROR_SCHEMA,
    }),
    ApiConflictResponse({
      description: 'Article slug already exists.',
      schema: CONFLICT_ERROR_SCHEMA,
    }),
    ApiUnprocessableEntityResponse({
      description: 'Request validation failed.',
      schema: VALIDATION_ERROR_SCHEMA,
    }),
  );
}
