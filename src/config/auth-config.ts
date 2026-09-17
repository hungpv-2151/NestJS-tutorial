import type { JwtModuleOptions } from '@nestjs/jwt';

export interface AuthConfig {
  audience: string;
  issuer: string;
  secret: string;
}

export class AuthConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigValidationError';
  }
}

export function getAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AuthConfig {
  return {
    audience: required(environment, 'JWT_AUDIENCE'),
    issuer: required(environment, 'JWT_ISSUER'),
    secret: required(environment, 'JWT_SECRET'),
  };
}

export function toJwtModuleOptions(config: AuthConfig): JwtModuleOptions {
  return {
    secret: config.secret,
    signOptions: {
      algorithm: 'HS256',
    },
    verifyOptions: {
      algorithms: ['HS256'],
      audience: config.audience,
      issuer: config.issuer,
    },
  };
}

function required(environment: NodeJS.ProcessEnv, key: keyof NodeJS.ProcessEnv): string {
  const value = environment[key]?.trim();
  if (!value) {
    throw new AuthConfigValidationError(`${key} is required`);
  }

  return value;
}
