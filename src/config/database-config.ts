export interface DatabaseConfig {
  url: string;
}

export class DatabaseConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigValidationError';
  }
}

export function getDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
): DatabaseConfig {
  const url = environment.DATABASE_URL;
  if (!url) {
    throw new DatabaseConfigValidationError('DATABASE_URL is required');
  }

  if (!isPostgresUrl(url)) {
    throw new DatabaseConfigValidationError('DATABASE_URL must be PostgreSQL');
  }

  return { url };
}

export function isDatabaseEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  const value = environment.DATABASE_ENABLED;
  if (value === undefined || value === 'false') {
    return false;
  }

  if (value === 'true') {
    return true;
  }

  throw new DatabaseConfigValidationError(
    'DATABASE_ENABLED must be true or false',
  );
}

function isPostgresUrl(url: string): boolean {
  if (!URL.canParse(url)) {
    return false;
  }

  const parsedUrl = new URL(url);
  return (
    ['postgres:', 'postgresql:'].includes(parsedUrl.protocol) &&
    parsedUrl.hostname.length > 0 &&
    parsedUrl.pathname.length > 1
  );
}
