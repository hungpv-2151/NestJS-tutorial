export type SupportedLocale = 'en' | 'vi';

export interface HelloResponse {
  locale: SupportedLocale;
  message: string;
}

export function serializeHelloResponse(
  locale: string | undefined,
  message: string,
): HelloResponse {
  return {
    message,
    locale: locale === 'vi' || locale?.startsWith('vi-') ? 'vi' : 'en',
  };
}
