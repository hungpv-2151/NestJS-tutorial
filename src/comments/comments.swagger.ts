import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
  ApiProperty,
  ApiSecurity,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger';

import { TOKEN_AUTH_SECURITY_SCHEME } from '../auth/auth.swagger.js';
import { COMMENT_BODY_MAX_LENGTH } from '../common/dto/comment-create.dto.js';

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
const COMMENTS_RESPONSE_SCHEMA = {
  additionalProperties: false,
  properties: {
    comments: {
      items: { $ref: getSchemaPath(CommentResponse) },
      type: 'array',
    },
  },
  required: ['comments'],
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

export function GetArticleCommentsSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'List comments for an article',
      description:
        'Returns comments in createdAt and id ascending order. Authentication is optional; a supplied invalid Token is rejected, and author following state is personalized for authenticated viewers.',
    }),
    ApiParam({
      description: 'Slug of the article whose comments are requested.',
      name: 'slug',
      required: true,
      type: String,
    }),
    ApiHeader({
      description: 'Optional JWT presented as Token <jwt>.',
      example: 'Token <jwt>',
      name: 'Authorization',
      required: false,
    }),
    ApiSecurity(TOKEN_AUTH_SECURITY_SCHEME),
    ApiSecurity({}),
    ApiExtraModels(CommentAuthorResponse, CommentResponse),
    ApiOkResponse({
      description: 'Comments for the requested article.',
      schema: COMMENTS_RESPONSE_SCHEMA,
    }),
    ApiUnauthorizedResponse({
      description: 'Supplied token is invalid.',
      schema: {
        example: { errors: { token: ['is invalid'] } },
        type: 'object',
      },
    }),
    ApiNotFoundResponse({
      description: 'Article slug was not found.',
      schema: ARTICLE_NOT_FOUND_SCHEMA,
    }),
    ApiInternalServerErrorResponse({
      description: 'Comments could not be loaded.',
      schema: PERSISTENCE_ERROR_SCHEMA,
    }),
  );
}

const DELETE_TOKEN_ERROR_SCHEMA = {
  example: { errors: { token: ['is missing'] } },
  type: 'object',
};
const DELETE_COMMENT_FORBIDDEN_SCHEMA = {
  example: { errors: { comment: ['forbidden'] } },
  type: 'object',
};
const DELETE_NOT_FOUND_SCHEMA = {
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
const DELETE_INVALID_ID_SCHEMA = {
  example: { errors: { id: ['must be an integer'] } },
  type: 'object',
};
const DELETE_PERSISTENCE_ERROR_SCHEMA = {
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
      schema: DELETE_TOKEN_ERROR_SCHEMA,
    }),
    ApiForbiddenResponse({
      description: 'The authenticated user does not own this comment.',
      schema: DELETE_COMMENT_FORBIDDEN_SCHEMA,
    }),
    ApiNotFoundResponse({
      description: 'Article or comment was not found in this article.',
      schema: DELETE_NOT_FOUND_SCHEMA,
    }),
    ApiUnprocessableEntityResponse({
      description: 'Comment ID must be an integer.',
      schema: DELETE_INVALID_ID_SCHEMA,
    }),
    ApiInternalServerErrorResponse({
      description: 'Comment deletion failed.',
      schema: DELETE_PERSISTENCE_ERROR_SCHEMA,
    }),
  );
}
