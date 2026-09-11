import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { configureApp } from './app-bootstrap.js';
import { AppModule } from './app.module.js';
import { environmentKeys } from './config/environment.validation.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(app.get(ConfigService).getOrThrow<number>(environmentKeys.port));
}
await bootstrap();
