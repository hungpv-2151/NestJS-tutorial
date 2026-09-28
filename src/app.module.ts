import { Module } from '@nestjs/common';
import { I18nModule, AcceptLanguageResolver } from 'nestjs-i18n';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { AttachmentsModule } from './attachments/attachments.module.js';
import { FilesModule } from './files/files.module.js';
import { ArticlesModule } from './articles/articles.module.js';
import { TagsModule } from './tags/tags.module.js';

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
    AuthModule,
    ProfilesModule,
    AttachmentsModule,
    FilesModule,
    ArticlesModule,
    TagsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
