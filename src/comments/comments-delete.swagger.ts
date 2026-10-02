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
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { TOKEN_AUTH_SECURITY_SCHEME } from '../auth/auth.swagger.js';

const TOKEN_ERROR_SCHEMA = {
  example: { errors: { token: ['is missing'] } },
  type: 'object',
};
const COMMENT_FORBIDDEN_SCHEMA = {
  example: { errors: { comment: ['forbidden'] } },
  type: 'object',
};
const NOT_FOUND_SCHEMA = {
  anyOf: [
    {
      example: { errors: { article: ['not found'] } },
      type: 'object',
    },
    {
      example: { errors: { comment: ['not found'] } },
      type: 'object',
    },
  ],
};
const INVALID_ID_SCHEMA = {
  example: { errors: { id: ['must be an integer'] } },
  type: 'object',
};
const PERSISTENCE_ERROR_SCHEMA = {
  example: { errors: { body: ['request failed'] } },
  type: 'object',
};

export function DeleteArticleCommentSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete a comment for an article',
      description: 'Deletes a comment owned by the authenticated user.',
    }),
    ApiParam({
      description: 'Slug of the article containing the comment.',
      name: 'slug',
      required: true,
      type: String,
    }),
    ApiParam({
      description: 'Integer ID of the comment to delete.',
      name: 'id',
      required: true,
      type: Number,
    }),
    ApiHeader({
      description: 'JWT presented as Token <jwt>.',
      example: 'Token <jwt>',
      name: 'Authorization',
      required: true,
    }),
    ApiSecurity(TOKEN_AUTH_SECURITY_SCHEME),
    ApiNoContentResponse({
      description: 'Comment deleted; response is empty.',
    }),
    ApiUnauthorizedResponse({
      description: 'Token is missing or invalid.',
      schema: TOKEN_ERROR_SCHEMA,
    }),
    ApiForbiddenResponse({
      description: 'The authenticated user does not own this comment.',
      schema: COMMENT_FORBIDDEN_SCHEMA,
    }),
    ApiNotFoundResponse({
      description: 'Article or comment was not found in this article.',
      schema: NOT_FOUND_SCHEMA,
    }),
    ApiUnprocessableEntityResponse({
      description: 'Comment ID must be an integer.',
      schema: INVALID_ID_SCHEMA,
    }),
    ApiInternalServerErrorResponse({
      description: 'Comment deletion failed.',
      schema: PERSISTENCE_ERROR_SCHEMA,
    }),
  );
}
