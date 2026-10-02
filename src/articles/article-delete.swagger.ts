import { applyDecorators } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { TOKEN_AUTH_SECURITY_SCHEME } from '../auth/auth.swagger.js';

const TOKEN_ERROR_SCHEMA = {
  example: { errors: { token: ['is missing'] } },
  type: 'object',
};
const ARTICLE_FORBIDDEN_SCHEMA = {
  example: { errors: { article: ['forbidden'] } },
  type: 'object',
};
const ARTICLE_NOT_FOUND_SCHEMA = {
  example: { errors: { article: ['not found'] } },
  type: 'object',
};
const PERSISTENCE_ERROR_SCHEMA = {
  example: { errors: { body: ['request failed'] } },
  type: 'object',
};

export function DeleteArticleSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete an article',
      description: 'Deletes an article owned by the authenticated user.',
    }),
    ApiParam({
      description: 'Slug of the article to delete.',
      name: 'slug',
      required: true,
      type: String,
    }),
    ApiHeader({
      description: 'JWT presented as Token <jwt>.',
      example: 'Token <jwt>',
      name: 'Authorization',
      required: true,
    }),
    ApiSecurity(TOKEN_AUTH_SECURITY_SCHEME),
    ApiNoContentResponse({
      description: 'Article deleted; response is empty.',
    }),
    ApiUnauthorizedResponse({
      description: 'Token is missing or invalid.',
      schema: TOKEN_ERROR_SCHEMA,
    }),
    ApiForbiddenResponse({
      description: 'The authenticated user does not own this article.',
      schema: ARTICLE_FORBIDDEN_SCHEMA,
    }),
    ApiNotFoundResponse({
      description: 'Article slug was not found.',
      schema: ARTICLE_NOT_FOUND_SCHEMA,
    }),
    ApiInternalServerErrorResponse({
      description: 'Article deletion failed.',
      schema: PERSISTENCE_ERROR_SCHEMA,
    }),
  );
}
