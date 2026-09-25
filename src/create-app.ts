import {
  BadRequestException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import { getAppConfig } from './config/app-config.js';

export async function createApp(environment: NodeJS.ProcessEnv = process.env) {
  const config = getAppConfig(environment);
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(json({ limit: config.bodyLimit }));
  app.use(urlencoded({ extended: true, limit: config.bodyLimit }));
  app.setGlobalPrefix('api');
  configureGlobalRequestHandling(app);
  app.enableShutdownHooks();

  if (config.isSwaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('NestJS Tutorial API')
        .setDescription('Runtime API documentation')
        .setVersion('1.0.0')
        .build(),
    );
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs-json',
      useGlobalPrefix: false,
    });
  }

  await app.init();
  return app;
}

export function configureGlobalRequestHandling(app: INestApplication): void {
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: (validationErrors) =>
        new BadRequestException(validationErrors),
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
}
