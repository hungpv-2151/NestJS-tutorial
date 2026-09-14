import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { serializeHelloResponse } from './common/serializers/hello-response.serializer.js';
import { AppConfigValidationError, getAppConfig } from './config/app-config.js';

describe('AppController', () => {
  it('serializes the selected locale and translated hello message', () => {
    const appService = {
      getHello: vi.fn().mockReturnValue('Xin chào!'),
    } as unknown as AppService;
    const controller = new AppController(appService);

    expect(controller.getHello('vi')).toEqual({
      message: 'Xin chào!',
      locale: 'vi',
    });
    expect(appService.getHello).toHaveBeenCalledWith('vi');
  });
});

describe('getAppConfig', () => {
  it('uses defaults and accepts valid port and body-limit overrides', () => {
    expect(getAppConfig({})).toEqual({
      bodyLimit: '100kb',
      isSwaggerEnabled: true,
      port: 3000,
    });
    expect(
      getAppConfig({
        BODY_LIMIT: '2MB',
        NODE_ENV: 'production',
        PORT: '8080',
      }),
    ).toEqual({
      bodyLimit: '2MB',
      isSwaggerEnabled: false,
      port: 8080,
    });
  });

  it('enables Swagger for explicit production and non-production settings', () => {
    expect(
      getAppConfig({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })
        .isSwaggerEnabled,
    ).toBe(true);
    expect(
      getAppConfig({ NODE_ENV: 'test', SWAGGER_ENABLED: 'false' })
        .isSwaggerEnabled,
    ).toBe(true);
  });

  it('rejects malformed external environment values', () => {
    expect(() => getAppConfig({ PORT: 'not-a-port' })).toThrow(
      AppConfigValidationError,
    );
    expect(() => getAppConfig({ BODY_LIMIT: '100' })).toThrow(
      AppConfigValidationError,
    );
    expect(() => getAppConfig({ BODY_LIMIT: '0kb' })).toThrow(
      AppConfigValidationError,
    );
  });
});

describe('serializeHelloResponse', () => {
  it.each([
    ['vi', 'vi'],
    ['vi-VN', 'vi'],
    ['en', 'en'],
    ['fr-FR', 'en'],
    [undefined, 'en'],
  ] as const)('normalizes %s to %s', (requestedLocale, locale) => {
    expect(serializeHelloResponse(requestedLocale, 'Hello!')).toEqual({
      locale,
      message: 'Hello!',
    });
  });
});

describe('AppService', () => {
  it('returns a translated greeting and rejects an invalid translation value', () => {
    const translate = vi.fn().mockReturnValue('Hello!');
    const service = new AppService({ translate } as never);

    expect(service.getHello('en')).toBe('Hello!');
    expect(translate).toHaveBeenCalledWith('hello.message', { lang: 'en' });

    translate.mockReturnValueOnce({ message: 'invalid' });
    expect(() => service.getHello('vi')).toThrow(
      'The hello translation for locale vi is unavailable',
    );
  });
});
