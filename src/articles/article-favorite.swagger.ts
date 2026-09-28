import { applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiSecurity,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger';

import { TOKEN_AUTH_SECURITY_SCHEME } from '../auth/auth.swagger.js';

class FavoriteArticleProfileResponse {
  @ApiProperty({ nullable: true, type: String })
  bio!: string | null;

  @ApiProperty({ type: Boolean })
  following!: boolean;

  @ApiProperty({ nullable: true, type: String })
  image!: string | null;

  @ApiProperty({ type: String })
  username!: string;
}

class FavoriteArticleResponse {
  @ApiProperty({ type: FavoriteArticleProfileResponse })
  author!: FavoriteArticleProfileResponse;

  @ApiProperty({ type: String })
  body!: string;

  @ApiProperty({ format: 'date-time', type: String })
  createdAt!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ type: Boolean })
  favorited!: boolean;

  @ApiProperty({ type: 'integer' })
  favoritesCount!: number;

  @ApiProperty({ type: String })
  slug!: string;

  @ApiProperty({ items: { type: 'string' }, type: [String] })
  tagList!: string[];

  @ApiProperty({ type: String })
  title!: string;

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
  example: { errors: { body: ['is invalid'] } },
  type: 'object',
};
const PERSISTENCE_ERROR_SCHEMA = {
  example: { errors: { body: ['request failed'] } },
  type: 'object',
};
const SINGLE_ARTICLE_RESPONSE_SCHEMA = {
  additionalProperties: false,
  properties: {
    article: { $ref: getSchemaPath(FavoriteArticleResponse) },
  },
  required: ['article'],
  type: 'object',
};

export function CreateArticleFavoriteSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: 'Favorite an article' }),
    ApiParam({
      description: 'Slug of the article to favorite.',
      name: 'slug',
      required: true,
      type: String,
    }),
    ApiExtraModels(FavoriteArticleProfileResponse, FavoriteArticleResponse),
    ApiSecurity(TOKEN_AUTH_SECURITY_SCHEME),
    ApiOkResponse({
      description:
        'Article details with the authenticated viewer favoriting it.',
      schema: SINGLE_ARTICLE_RESPONSE_SCHEMA,
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
      description: 'Favorite could not be created.',
      schema: PERSISTENCE_ERROR_SCHEMA,
    }),
  );
}
