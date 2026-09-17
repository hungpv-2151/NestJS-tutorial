import { Module } from '@nestjs/common';
import { I18nModule, AcceptLanguageResolver } from 'nestjs-i18n';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { RegisterUserModule } from './auth/register-user.module.js';

const translationsPath = join(dirname(fileURLToPath(import.meta.url)), 'i18n');

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: translationsPath,
        watch: process.env.NODE_ENV !== 'production',
      },
      resolvers: [AcceptLanguageResolver],
    }),
    RegisterUserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
