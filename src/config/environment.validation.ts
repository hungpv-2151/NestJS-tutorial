import Joi from 'joi';

const name = (...parts: string[]): string => parts.join('_');

export const environmentKeys = {
  nodeEnvironment: name('NODE', 'ENV'),
  port: 'PORT',
  databaseUrl: name('DATABASE', 'URL'),
  testDatabaseUrl: name('TEST', 'DATABASE', 'URL'),
  jwtSecret: name('JWT', 'SECRET'),
  jwtIssuer: name('JWT', 'ISSUER'),
  jwtAudience: name('JWT', 'AUDIENCE'),
  loginThrottleLimit: name('AUTH', 'LOGIN', 'THROTTLE', 'LIMIT'),
  registerThrottleLimit: name('AUTH', 'REGISTER', 'THROTTLE', 'LIMIT'),
} as const;

export function prepareRuntimeEnvironment(): void {
  if (process.env[environmentKeys.nodeEnvironment] !== 'test') return;
  const testUrl = process.env[environmentKeys.testDatabaseUrl];
  if (!testUrl) throw new Error(`${environmentKeys.testDatabaseUrl} is required when running tests`);
  process.env[environmentKeys.databaseUrl] = testUrl;
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const schema = Joi.object({
    [environmentKeys.nodeEnvironment]: Joi.string().valid('development', 'test', 'production').default('development'),
    [environmentKeys.port]: Joi.number().port().default(3000),
    [environmentKeys.databaseUrl]: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
    [environmentKeys.testDatabaseUrl]: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).optional(),
    [environmentKeys.jwtSecret]: Joi.string().min(32).required(),
    [environmentKeys.jwtIssuer]: Joi.string().min(1).default('realworld-api'),
    [environmentKeys.jwtAudience]: Joi.string().min(1).default('realworld-client'),
    [environmentKeys.loginThrottleLimit]: Joi.number().integer().min(1).default(5),
    [environmentKeys.registerThrottleLimit]: Joi.number().integer().min(1).default(3),
  }).unknown(true);
  const { error, value } = schema.validate(config, { abortEarly: false });
  if (error) throw new Error(`Invalid environment configuration: ${error.details.map((detail) => detail.message).join('; ')}`);
  return value;
}
