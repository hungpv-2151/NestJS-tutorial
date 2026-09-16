import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import type { SupportedLocale } from './common/serializers/hello-response.serializer.js';

class I18nTranslationError extends Error {
  constructor(locale: SupportedLocale) {
    super(`The hello translation for locale ${locale} is unavailable`);
    this.name = 'I18nTranslationError';
  }
}

@Injectable()
export class AppService {
  constructor(private readonly i18n: I18nService) {}

  getHello(locale: SupportedLocale): string {
    const message = this.i18n.translate('hello.message', { lang: locale });
    if (typeof message !== 'string') {
      throw new I18nTranslationError(locale);
    }

    return message;
  }
}
