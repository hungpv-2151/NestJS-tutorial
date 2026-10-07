import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiQuery,
  ApiSecurity,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger';

import { TOKEN_AUTH_SECURITY_SCHEME } from '../auth/auth.swagger.js';
import { CreateArticleRequestDto } from '../common/dto/article.dto.js';

namespace articles.swagger {
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
  const ARTICLE_FORBIDDEN_SCHEMA = {
    example: { errors: { article: ['forbidden'] } },
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
  const UPDATE_ARTICLE_REQUEST_SCHEMA = {
    additionalProperties: false,
    properties: {
      article: {
        additionalProperties: false,
        properties: {
          body: { type: 'string' },
          description: { type: 'string' },
          tagList: {
            items: { pattern: '\\S', type: 'string' },
            type: 'array',
          },
          title: { type: 'string' },
        },
        type: 'object',
      },
    },
    required: ['article'],
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
          'Anonymous requests do not require authentication and return 200. An optional Token authorization header personalizes favorite and follow flags. If a token is supplied but invalid, the request returns 401.',
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
        description:
          'Returned only when the supplied token is invalid; no token is required.',
        schema: INVALID_AUTH_ERROR_SCHEMA,
      }),
      ApiUnprocessableEntityResponse({
        description: 'Request validation failed.',
        schema: VALIDATION_ERROR_SCHEMA,
      }),
    );
  }

  export function UpdateArticleSwagger(): MethodDecorator {
    return applyDecorators(
      ApiOperation({
        summary: 'Update an article',
        description:
          'Updates supplied fields for the authenticated owner. The slug stays stable; an empty article object leaves the article unchanged. A supplied tagList replaces the ordered list, and an empty list clears it.',
      }),
      ApiHeader({
        description: 'JWT presented as Token <jwt>.',
        example: 'Token <jwt>',
        name: 'Authorization',
        required: true,
      }),
      ApiSecurity(TOKEN_AUTH_SECURITY_SCHEME),
      ApiBody({ schema: UPDATE_ARTICLE_REQUEST_SCHEMA }),
      ApiOkResponse({
        description: 'Updated article details.',
        schema: ARTICLE_RESPONSE_SCHEMA,
      }),
      ApiUnauthorizedResponse({
        description: 'Token is missing or invalid.',
        schema: INVALID_AUTH_ERROR_SCHEMA,
      }),
      ApiForbiddenResponse({
        description: 'The authenticated user does not own this article.',
        schema: ARTICLE_FORBIDDEN_SCHEMA,
      }),
      ApiNotFoundResponse({
        description: 'Article slug was not found.',
        schema: ARTICLE_NOT_FOUND_SCHEMA,
      }),
      ApiUnprocessableEntityResponse({
        description: 'Request validation failed.',
        schema: VALIDATION_ERROR_SCHEMA,
      }),
    );
  }
}

namespace article_delete.swagger {
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
}

namespace article_feed.swagger {
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
}

namespace article_list.swagger {
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
      ApiQuery({
        name: 'favorited',
        required: false,
        schema: { type: 'string' },
      }),
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
        description:
          'Article list and count after filtering, before pagination.',
        schema: {
          required: ['articles', 'articlesCount'],
          type: 'object',
          properties: {
            articles: { type: 'array', items: { type: 'object' } },
            articlesCount: { type: 'integer' },
          },
          example: {
            articles: [
              {
                slug: 'article-slug',
                title: 'Article title',
                description: 'Article description',
                tagList: ['nestjs'],
                createdAt: '2026-09-28T00:00:00.000Z',
                updatedAt: '2026-09-28T00:00:00.000Z',
                favorited: false,
                favoritesCount: 0,
                author: {
                  username: 'writer',
                  bio: null,
                  image: null,
                  following: false,
                },
              },
            ],
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
}

namespace article_favorite.swagger {
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
    example: { errors: { body: ['internal server error'] } },
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
}

export const CreateArticleSwagger = articles.swagger.CreateArticleSwagger;
export const GetArticleSwagger = articles.swagger.GetArticleSwagger;
export const UpdateArticleSwagger = articles.swagger.UpdateArticleSwagger;
export const DeleteArticleSwagger = article_delete.swagger.DeleteArticleSwagger;
export const GetArticleFeedSwagger = article_feed.swagger.GetArticleFeedSwagger;
export const GetArticleListSwagger = article_list.swagger.GetArticleListSwagger;
export const CreateArticleFavoriteSwagger =
  article_favorite.swagger.CreateArticleFavoriteSwagger;
export const DeleteArticleFavoriteSwagger =
  article_favorite.swagger.DeleteArticleFavoriteSwagger;
