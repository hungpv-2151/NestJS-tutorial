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

const CREATE_FAVORITE_COPY = {
  summary: 'Favorite an article',
  slugDescription: 'Slug of the article to favorite.',
  viewerAction: 'favoriting it.',
  failureDescription: 'Favorite could not be created.',
};
const DELETE_FAVORITE_COPY = {
  summary: 'Unfavorite an article',
  slugDescription: 'Slug of the article to unfavorite.',
  viewerAction: 'unfavoriting it.',
  failureDescription: 'Favorite could not be deleted.',
};

export function CreateArticleFavoriteSwagger(): MethodDecorator {
  return articleFavoriteSwagger(CREATE_FAVORITE_COPY);
}

export function DeleteArticleFavoriteSwagger(): MethodDecorator {
  return articleFavoriteSwagger(DELETE_FAVORITE_COPY);
}

function articleFavoriteSwagger(copy: {
  summary: string;
  slugDescription: string;
  viewerAction: string;
  failureDescription: string;
}): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: copy.summary }),
    ApiParam({
      description: copy.slugDescription,
      name: 'slug',
      required: true,
      type: String,
    }),
    ApiExtraModels(FavoriteArticleProfileResponse, FavoriteArticleResponse),
    ApiSecurity(TOKEN_AUTH_SECURITY_SCHEME),
    ApiOkResponse({
      description: `Article details with the authenticated viewer ${copy.viewerAction}`,
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
      description: copy.failureDescription,
      schema: PERSISTENCE_ERROR_SCHEMA,
    }),
  );
}
