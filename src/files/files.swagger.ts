import { applyDecorators } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { TOKEN_AUTH_SECURITY_SCHEME } from '../auth/auth.swagger.js';

export function FileReadSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({ summary: 'Read a private attachment owned by the user' }),
    ApiParam({ description: 'Attachment UUID.', format: 'uuid', name: 'id' }),
    ApiSecurity(TOKEN_AUTH_SECURITY_SCHEME),
    ApiOkResponse({
      content: {
        'image/jpeg': {},
        'image/png': {},
        'image/webp': {},
      },
      description: 'Private image bytes with safe cache and sniffing headers.',
    }),
    ApiUnauthorizedResponse({ description: 'Token is missing or invalid.' }),
    ApiNotFoundResponse({
      description: 'Attachment is unavailable or not owned by the user.',
      schema: { example: { errors: { file: ['not found'] } } },
    }),
  );
}
