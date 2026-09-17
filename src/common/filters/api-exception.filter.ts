import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

export interface RealWorldErrors {
  errors: Record<string, string[]>;
}

export interface FormattedApiException {
  body: RealWorldErrors;
  statusCode: number;
}

const NOT_EMPTY_CONSTRAINT = 'isNotEmpty';
const CANNOT_BE_BLANK = "can't be blank";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const formatted = formatApiException(exception);
    host
      .switchToHttp()
      .getResponse<{
        status(code: number): { json(body: RealWorldErrors): void };
      }>()
      .status(formatted.statusCode)
      .json(formatted.body);
  }
}

export function formatApiException(exception: unknown): FormattedApiException {
  if (!(exception instanceof HttpException)) {
    return internalServerError();
  }

  const response = exception.getResponse();
  const existingErrors = getExistingErrors(response);
  if (existingErrors) {
    return {
      body: { errors: existingErrors },
      statusCode: exception.getStatus(),
    };
  }

  const validationErrors = getValidationErrors(response);
  if (validationErrors) {
    return {
      body: { errors: validationErrors },
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    };
  }

  return {
    body: { errors: { body: ['request failed'] } },
    statusCode: exception.getStatus(),
  };
}

function getExistingErrors(
  response: unknown,
): Record<string, string[]> | undefined {
  if (!isRecord(response) || !isRecord(response.errors)) {
    return undefined;
  }

  const entries = Object.entries(response.errors);
  if (entries.every(([, messages]) => isStringArray(messages))) {
    return Object.fromEntries(entries) as Record<string, string[]>;
  }

  return undefined;
}

function getValidationErrors(
  response: unknown,
): Record<string, string[]> | undefined {
  if (!isRecord(response) || !Array.isArray(response.message)) {
    return undefined;
  }

  const errors = flattenValidationErrors(response.message);
  return Object.keys(errors).length > 0 ? errors : undefined;
}

function flattenValidationErrors(
  errors: unknown[],
  prefix = '',
): Record<string, string[]> {
  return errors.reduce<Record<string, string[]>>((result, error) => {
    if (!isRecord(error) || typeof error.property !== 'string') {
      return result;
    }

    const field = prefix ? `${prefix}.${error.property}` : error.property;
    const constraints = isRecord(error.constraints) ? error.constraints : undefined;
    if (constraints) {
      result[field] = Object.keys(constraints)
        .sort(
          (left, right) =>
            Number(right === NOT_EMPTY_CONSTRAINT) -
            Number(left === NOT_EMPTY_CONSTRAINT),
        )
        .map((constraint) =>
          constraint === NOT_EMPTY_CONSTRAINT ? CANNOT_BE_BLANK : 'is invalid',
        );
    }
    if (Array.isArray(error.children)) {
      Object.assign(
        result,
        flattenValidationErrors(
          error.children,
          constraints ? field : prefix,
        ),
      );
    }
    return result;
  }, {});
}

function internalServerError(): FormattedApiException {
  return {
    body: { errors: { body: ['internal server error'] } },
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}
