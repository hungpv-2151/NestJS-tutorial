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

  const testDatabase = getDatabaseConfig({ DATABASE_URL: testDatabaseUrl });
  const applicationDatabaseUrl = environment.DATABASE_URL;

  if (applicationDatabaseUrl && !isPostgresUrl(applicationDatabaseUrl)) {
    throw new DatabaseConfigValidationError('DATABASE_URL must be PostgreSQL');
  }

  if (
    applicationDatabaseUrl &&
    sameDatabaseTarget(testDatabaseUrl, applicationDatabaseUrl)
  ) {
    throw new DatabaseConfigValidationError(
      'TEST_DATABASE_URL must target a different database than DATABASE_URL',
    );
  }

  return testDatabase;
}

function sameDatabaseTarget(firstUrl: string, secondUrl: string): boolean {
  const first = new URL(firstUrl);
  const second = new URL(secondUrl);

  return (
    normalizeDatabaseHost(first.hostname) ===
      normalizeDatabaseHost(second.hostname) &&
    (first.port || '5432') === (second.port || '5432') &&
    decodeURIComponent(first.pathname) === decodeURIComponent(second.pathname)
  );
}

function normalizeDatabaseHost(hostname: string): string {
  const host = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (host === 'localhost' || host === '::1' || host.startsWith('127.')) {
    return 'loopback';
  }
  return host;
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
