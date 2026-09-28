import { applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiProperty,
  ApiSecurity,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger';

import { TOKEN_AUTH_SECURITY_SCHEME } from '../auth/auth.swagger.js';

class ArticleFeedAuthorResponse {
  @ApiProperty({ nullable: true, type: String })
  bio!: string | null;

  @ApiProperty({ nullable: true, type: String })
  image!: string | null;

  @ApiProperty({ type: Boolean })
  following!: boolean;

  @ApiProperty({ type: String })
  username!: string;
}

class ArticleFeedItemResponse {
  @ApiProperty({ type: ArticleFeedAuthorResponse })
  author!: ArticleFeedAuthorResponse;

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

class MultipleArticlesResponse {
  @ApiProperty({ type: () => [ArticleFeedItemResponse] })
  articles!: ArticleFeedItemResponse[];

  @ApiProperty({ type: 'integer' })
  articlesCount!: number;
}

const TOKEN_ERROR_SCHEMA = {
  example: { errors: { token: ['is missing'] } },
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
const ARTICLE_FEED_ITEM_SCHEMA = {
  required: [
    'author',
    'createdAt',
    'description',
    'favorited',
    'favoritesCount',
    'slug',
    'tagList',
    'title',
    'updatedAt',
  ],
  type: 'object',
  properties: {
    slug: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    tagList: { type: 'array', items: { type: 'string' } },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    favorited: { type: 'boolean' },
    favoritesCount: { type: 'integer' },
    author: { $ref: getSchemaPath(ArticleFeedAuthorResponse) },
  },
};
const ARTICLE_FEED_RESPONSE_SCHEMA = {
  required: ['articles', 'articlesCount'],
  type: 'object',
  properties: {
    articles: { type: 'array', items: ARTICLE_FEED_ITEM_SCHEMA },
    articlesCount: { type: 'integer' },
  },
};

export function GetArticleFeedSwagger(): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(
      ArticleFeedAuthorResponse,
      ArticleFeedItemResponse,
      MultipleArticlesResponse,
    ),
    ApiOperation({
      summary: 'Get recent articles from users you follow',
      description:
        'Returns recent articles from followed authors. Pagination defaults to offset 0 and limit 20; limit is capped at 100.',
    }),
    ApiSecurity(TOKEN_AUTH_SECURITY_SCHEME),
    ApiQuery({
      name: 'offset',
      required: false,
      description: 'Items to skip. Defaults to 0.',
      schema: { type: 'integer', minimum: 0, default: 0 },
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      description: 'Items to return. Defaults to 20; maximum 100.',
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    }),
    ApiOkResponse({
      description: 'Followed authors’ articles and count before pagination.',
      schema: ARTICLE_FEED_RESPONSE_SCHEMA,
    }),
    ApiUnauthorizedResponse({
      description: 'Token is missing or invalid.',
      schema: TOKEN_ERROR_SCHEMA,
    }),
    ApiUnprocessableEntityResponse({
      description: 'Query validation failed.',
      schema: QUERY_ERROR_SCHEMA,
    }),
    ApiInternalServerErrorResponse({
      description: 'Feed could not be loaded.',
      schema: PERSISTENCE_ERROR_SCHEMA,
    }),
  );
}
