import { applyDecorators } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

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
    ApiTags('Profile'),
    ApiOperation({ summary: 'Get a profile by username' }),
    ApiParam({ name: 'username', type: String }),
    ApiOkResponse({ description: 'Profile found.', schema: PROFILE_SCHEMA }),
    ApiNotFoundResponse({
      description: 'Profile does not exist.',
      schema: { example: { errors: { profile: ['not found'] } } },
    }),
  );
}
