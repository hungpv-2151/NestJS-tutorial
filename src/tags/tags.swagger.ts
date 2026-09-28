import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';

export function GetTagsSwagger(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Get tags',
      description:
        'Returns all tag names in alphabetical order. Authentication is not required.',
    }),
    ApiOkResponse({
      description: 'Tag names.',
      schema: {
        required: ['tags'],
        type: 'object',
        properties: {
          tags: { type: 'array', items: { type: 'string' } },
        },
        example: { tags: ['angular', 'react', 'vue'] },
      },
    }),
  );
}
