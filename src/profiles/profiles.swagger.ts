import { applyDecorators } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { TOKEN_AUTH_SECURITY_SCHEME } from '../auth/auth.swagger.js';

const PROFILE_SCHEMA = {
  example: {
    profile: {
      bio: null,
      following: false,
      image: null,
      username: 'jane',
    },
  },
  type: 'object',
};

export function GetProfileSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: 'Get a profile by username' }),
    ApiParam({ name: 'username', type: String }),
    ApiOkResponse({ description: 'Profile found.', schema: PROFILE_SCHEMA }),
    ApiNotFoundResponse({
      description: 'Profile does not exist.',
      schema: { example: { errors: { profile: ['not found'] } } },
    }),
  );
}

export function FollowProfileSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: 'Follow a profile by username' }),
    ApiParam({ name: 'username', type: String }),
    ApiSecurity(TOKEN_AUTH_SECURITY_SCHEME),
    ApiOkResponse({ description: 'Profile followed.', schema: PROFILE_SCHEMA }),
    ApiUnauthorizedResponse({ description: 'Token is missing or invalid.' }),
    ApiNotFoundResponse({
      description: 'Profile does not exist.',
      schema: { example: { errors: { profile: ['not found'] } } },
    }),
    ApiUnprocessableEntityResponse({
      description: 'A user cannot follow their own profile.',
    }),
  );
}
