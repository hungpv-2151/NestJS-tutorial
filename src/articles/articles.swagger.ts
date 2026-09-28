import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
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
const INVALID_AUTH_ERROR_SCHEMA = {
  example: { errors: { token: ['is invalid'] } },
  type: 'object',
};
const ARTICLE_NOT_FOUND_SCHEMA = {
  example: { errors: { article: ['not found'] } },
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
const ARTICLE_RESPONSE_SCHEMA = {
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
      schema: ARTICLE_RESPONSE_SCHEMA,
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

export function GetArticleSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Get an article',
      description:
        'Public article detail. An optional Token authorization header personalizes favorite and follow flags; an invalid supplied token is rejected.',
    }),
    ApiSecurity(TOKEN_AUTH_SECURITY_SCHEME),
    ApiSecurity({}),
    ApiOkResponse({
      description: 'Article details.',
      schema: ARTICLE_RESPONSE_SCHEMA,
    }),
    ApiNotFoundResponse({
      description: 'Article slug was not found.',
      schema: ARTICLE_NOT_FOUND_SCHEMA,
    }),
    ApiUnauthorizedResponse({
      description: 'Supplied token is invalid.',
      schema: INVALID_AUTH_ERROR_SCHEMA,
    }),
    ApiUnprocessableEntityResponse({
      description: 'Request validation failed.',
      schema: VALIDATION_ERROR_SCHEMA,
    }),
  );
}
