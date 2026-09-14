import { Controller, Get } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { I18nLang } from 'nestjs-i18n';
import { serializeHelloResponse } from './common/serializers/hello-response.serializer.js';
import type { HelloResponse } from './common/serializers/hello-response.serializer.js';
import { AppService } from './app.service.js';

@ApiTags('System')
@Controller('hello')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Return a localized greeting' })
  @ApiHeader({
    name: 'accept-language',
    required: false,
    description: 'Preferred response locale: en or vi.',
  })
  @ApiOkResponse({
    schema: {
      example: { message: 'Hello!', locale: 'en' },
      properties: {
        locale: { enum: ['en', 'vi'], type: 'string' },
        message: { type: 'string' },
      },
      required: ['message', 'locale'],
      type: 'object',
    },
  })
  @ApiBadRequestResponse({
    schema: {
      example: {
        error: 'Bad Request',
        message: ['property example should not exist'],
        statusCode: 400,
      },
      properties: {
        error: { type: 'string' },
        message: { items: { type: 'string' }, type: 'array' },
        statusCode: { type: 'number' },
      },
      type: 'object',
    },
  })
  getHello(@I18nLang() locale: string): HelloResponse {
    const response = serializeHelloResponse(locale, '');
    return {
      ...response,
      message: this.appService.getHello(response.locale),
    };
  }
}
