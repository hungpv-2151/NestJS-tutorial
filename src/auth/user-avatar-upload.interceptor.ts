import {
  Injectable,
  HttpException,
  NestInterceptor,
  UnprocessableEntityException,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { catchError } from 'rxjs';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const UNEXPECTED_FILE_ERROR = 'LIMIT_UNEXPECTED_FILE';

@Injectable()
export class UserAvatarUploadInterceptor implements NestInterceptor {
  private readonly fileInterceptor = new (FileInterceptor('avatar', {
    limits: { fileSize: MAX_AVATAR_BYTES, files: 1, fields: 0 },
  }))();

  async intercept(context: ExecutionContext, next: CallHandler) {
    let result;
    try {
      result = await this.fileInterceptor.intercept(context, next);
    } catch (error) {
      throw mapAvatarUploadError(error);
    }
    return result.pipe(
      catchError((error: unknown) => {
        throw mapAvatarUploadError(error);
      }),
    );
  }
}

function mapAvatarUploadError(error: unknown): unknown {
  const status = error instanceof HttpException ? error.getStatus() : undefined;
  if (status === 413) {
    return new UnprocessableEntityException({
      errors: { avatar: ['is too large'] },
    });
  }
  if (status === 400 || isUnexpectedAvatarField(error)) {
    return new UnprocessableEntityException({
      errors: { avatar: ['is invalid'] },
    });
  }
  return error;
}

function isUnexpectedAvatarField(error: unknown): boolean {
  return isRecord(error) && error.code === UNEXPECTED_FILE_ERROR;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
