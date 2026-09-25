const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_FIELD_NAMES = new Set([
  'authorization',
  'cookie',
  'email',
  'firstname',
  'lastname',
  'displayname',
  'password',
  'passwordhash',
  'token',
  'username',
  'userid',
]);

export interface RequestForLog {
  body?: unknown;
  method?: string;
  params?: unknown;
  path?: string;
  query?: unknown;
}

export function createRequestFailureLog(
  error: unknown,
  request: RequestForLog | undefined,
): Record<string, unknown> {
  return {
    error: getErrorDetails(error),
    occurredAt: new Date().toISOString(),
    request: request ? sanitizeRequest(request) : undefined,
  };
}

function getErrorDetails(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    return { category: 'Error' };
  }
  return { category: 'UnknownError' };
}

function sanitizeRequest(request: RequestForLog): Record<string, unknown> {
  return {
    body: sanitizeValue(request.body),
    method: request.method,
    params: sanitizeValue(request.params),
    path: request.path,
    query: sanitizeValue(request.query),
  };
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SENSITIVE_FIELD_NAMES.has(key.toLowerCase())
        ? REDACTED_VALUE
        : sanitizeValue(entry),
    ]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
