const DEFAULT_PORT = 3000;
const DEFAULT_BODY_LIMIT = '100kb';

export class AppConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppConfigValidationError';
  }
}

export interface AppConfig {
  bodyLimit: string;
  isSwaggerEnabled: boolean;
  port: number;
}

export function getAppConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const port = parsePort(environment.PORT);
  const bodyLimit = parseBodyLimit(environment.BODY_LIMIT);
  const isProduction = environment.NODE_ENV === 'production';

  return {
    port,
    bodyLimit,
    isSwaggerEnabled: environment.SWAGGER_ENABLED === 'true' || !isProduction,
  };
}

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_PORT;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new AppConfigValidationError(
      'PORT must be an integer between 1 and 65535',
    );
  }

  return port;
}

function parseBodyLimit(value: string | undefined): string {
  const bodyLimit = value ?? DEFAULT_BODY_LIMIT;
  const match = /^(\d+)(kb|mb)$/i.exec(bodyLimit);
  if (match === null || Number(match[1]) < 1) {
    throw new AppConfigValidationError(
      'BODY_LIMIT must be a positive integer followed by kb or mb',
    );
  }

  return bodyLimit;
}
