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

  if (hasAmbiguousTargetOverrides(testDatabaseUrl)) {
    throw new DatabaseConfigValidationError(
      'TEST_DATABASE_URL must not contain empty, repeated, or invalid host/port parameters',
    );
  }

  if (applicationDatabaseUrl && !isPostgresUrl(applicationDatabaseUrl)) {
    throw new DatabaseConfigValidationError('DATABASE_URL must be PostgreSQL');
  }

  if (
    applicationDatabaseUrl &&
    hasAmbiguousTargetOverrides(applicationDatabaseUrl)
  ) {
    throw new DatabaseConfigValidationError(
      'DATABASE_URL must not contain empty, repeated, or invalid host/port parameters',
    );
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

function hasAmbiguousTargetOverrides(connectionUrl: string): boolean {
  const url = new URL(connectionUrl);
  return ['host', 'port'].some((parameter) => {
    const values = url.searchParams.getAll(parameter);
    return (
      values.length > 1 ||
      values.some((value) =>
        value.split(',').some((part) => {
          if (!part.trim()) return true;
          if (parameter !== 'port') return false;
          return (
            !/^\d+$/.test(part) || Number(part) < 1 || Number(part) > 65535
          );
        }),
      )
    );
  });
}

function sameDatabaseTarget(firstUrl: string, secondUrl: string): boolean {
  const first = new URL(firstUrl);
  const second = new URL(secondUrl);

  return (
    connectionHosts(first).some((host) =>
      connectionHosts(second).includes(host),
    ) &&
    connectionPorts(first).some((port) =>
      connectionPorts(second).includes(port),
    ) &&
    decodeURIComponent(first.pathname) === decodeURIComponent(second.pathname)
  );
}

function connectionHosts(url: URL): string[] {
  return (url.searchParams.get('host') ?? url.hostname)
    .split(',')
    .map(normalizeDatabaseHost);
}

function connectionPorts(url: URL): string[] {
  return (url.searchParams.get('port') ?? (url.port || '5432'))
    .split(',')
    .map((port) => String(Number.parseInt(port, 10)));
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
