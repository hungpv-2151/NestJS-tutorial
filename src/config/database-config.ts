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

export function getTestDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
): DatabaseConfig {
  const testDatabaseUrl = environment.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new DatabaseConfigValidationError('TEST_DATABASE_URL is required');
  }

  return getDatabaseConfig({ DATABASE_URL: testDatabaseUrl });
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
