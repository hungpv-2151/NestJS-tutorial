import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiSecurity,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger';

import { TOKEN_AUTH_SECURITY_SCHEME } from '../auth/auth.swagger.js';
import { COMMENT_BODY_MAX_LENGTH } from './comment-create.dto.js';

class CommentAuthorResponse {
  @ApiProperty({ nullable: true, type: String })
  bio!: string | null;

  @ApiProperty({ type: Boolean })
  following!: boolean;

  @ApiProperty({ nullable: true, type: String })
  image!: string | null;

  @ApiProperty({ type: String })
  username!: string;
}

class CommentResponse {
  @ApiProperty({ type: CommentAuthorResponse })
  author!: CommentAuthorResponse;

  @ApiProperty({ type: String })
  body!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;

  @ApiProperty({ type: 'integer' })
  id!: number;

  @ApiProperty({ format: 'date-time', type: String })
  updatedAt!: string;
}

const TOKEN_ERROR_SCHEMA = {
  example: { errors: { token: ['is missing'] } },
  type: 'object',
};
const ARTICLE_NOT_FOUND_SCHEMA = {
  example: { errors: { article: ['not found'] } },
  type: 'object',
};
const VALIDATION_ERROR_SCHEMA = {
  example: { errors: { body: ["can't be blank"] } },
  type: 'object',
};
const PERSISTENCE_ERROR_SCHEMA = {
  example: { errors: { body: ['request failed'] } },
  type: 'object',
};
const SINGLE_COMMENT_RESPONSE_SCHEMA = {
  additionalProperties: false,
  properties: { comment: { $ref: getSchemaPath(CommentResponse) } },
  required: ['comment'],
  type: 'object',
};
const CREATE_COMMENT_REQUEST_SCHEMA = {
  additionalProperties: false,
  properties: {
    comment: {
      additionalProperties: false,
      properties: {
        body: {
          maxLength: COMMENT_BODY_MAX_LENGTH,
          pattern: '\\S',
          type: 'string',
        },
      },
      required: ['body'],
      type: 'object',
    },
  },
  required: ['comment'],
  type: 'object',
};

export function CreateArticleCommentSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: 'Create a comment for an article' }),
    ApiParam({
      description: 'Slug of the article to comment on.',
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
    ApiExtraModels(CommentAuthorResponse, CommentResponse),
    ApiSecurity(TOKEN_AUTH_SECURITY_SCHEME),
    ApiBody({ schema: CREATE_COMMENT_REQUEST_SCHEMA }),
    ApiCreatedResponse({
      description: 'Comment created.',
      schema: SINGLE_COMMENT_RESPONSE_SCHEMA,
    }),
    ApiUnauthorizedResponse({
      description: 'Token is missing or invalid.',
      schema: TOKEN_ERROR_SCHEMA,
    }),
    ApiNotFoundResponse({
      description: 'Article slug was not found.',
      schema: ARTICLE_NOT_FOUND_SCHEMA,
    }),
    ApiUnprocessableEntityResponse({
      description: 'Request validation failed.',
      schema: VALIDATION_ERROR_SCHEMA,
    }),
    ApiInternalServerErrorResponse({
      description: 'Comment could not be created.',
      schema: PERSISTENCE_ERROR_SCHEMA,
    }),
  );
}
