import { applyDecorators } from '@nestjs/common';
import {
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { TOKEN_AUTH_SECURITY_SCHEME } from '../auth/auth.swagger.js';

const TOKEN_ERROR_SCHEMA = {
  example: { errors: { token: ['is invalid'] } },
  type: 'object',
};
const QUERY_ERROR_SCHEMA = {
  example: { errors: { offset: ['is invalid'] } },
  type: 'object',
};
const PERSISTENCE_ERROR_SCHEMA = {
  example: { errors: { body: ['request failed'] } },
  type: 'object',
};

export function GetArticleListSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'List articles',
      description:
        'Returns the newest articles with optional exact-match filters. An optional Token header personalizes favorite and follow fields; a supplied invalid token is rejected.',
    }),
    ApiSecurity(TOKEN_AUTH_SECURITY_SCHEME),
    ApiSecurity({}),
    ApiQuery({ name: 'tag', required: false, schema: { type: 'string' } }),
    ApiQuery({ name: 'author', required: false, schema: { type: 'string' } }),
    ApiQuery({ name: 'favorited', required: false, schema: { type: 'string' } }),
    ApiQuery({
      name: 'offset',
      required: false,
      schema: { type: 'integer', minimum: 0, default: 0 },
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    }),
    ApiOkResponse({
      description: 'Article list and count after filtering, before pagination.',
      schema: {
        required: ['articles', 'articlesCount'],
        type: 'object',
        properties: {
          articles: { type: 'array', items: { type: 'object' } },
          articlesCount: { type: 'integer' },
        },
        example: {
          articles: [{
            slug: 'article-slug',
            title: 'Article title',
            description: 'Article description',
            tagList: ['nestjs'],
            createdAt: '2026-09-28T00:00:00.000Z',
            updatedAt: '2026-09-28T00:00:00.000Z',
            favorited: false,
            favoritesCount: 0,
            author: { username: 'writer', bio: null, image: null, following: false },
          }],
          articlesCount: 1,
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Supplied token is invalid.',
      schema: TOKEN_ERROR_SCHEMA,
    }),
    ApiUnprocessableEntityResponse({
      description: 'Query validation failed.',
      schema: QUERY_ERROR_SCHEMA,
    }),
    ApiInternalServerErrorResponse({
      description: 'Article list could not be loaded.',
      schema: PERSISTENCE_ERROR_SCHEMA,
    }),
  );
}
