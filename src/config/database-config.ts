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

  const allowedHosts = getRequiredAllowlist(
    environment.TEST_DATABASE_ALLOWED_HOSTS,
    'TEST_DATABASE_ALLOWED_HOSTS',
  );
  const allowedDatabaseNames = getRequiredAllowlist(
    environment.TEST_DATABASE_ALLOWED_NAMES,
    'TEST_DATABASE_ALLOWED_NAMES',
  );
  const databaseConfig = getDatabaseConfig({ DATABASE_URL: testDatabaseUrl });
  const databaseUrl = new URL(databaseConfig.url);
  const databaseName = databaseUrl.pathname.slice(1);

  if (!allowedHosts.includes(databaseUrl.hostname)) {
    throw new DatabaseConfigValidationError(
      'TEST_DATABASE_URL host is not allowlisted',
    );
  }

  if (!allowedDatabaseNames.includes(databaseName)) {
    throw new DatabaseConfigValidationError(
      'TEST_DATABASE_URL database is not allowlisted',
    );
  }

  return databaseConfig;
}

function getRequiredAllowlist(value: string | undefined, name: string): string[] {
  const entries = value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!entries?.length) {
    throw new DatabaseConfigValidationError(`${name} is required`);
  }

  return entries;
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
