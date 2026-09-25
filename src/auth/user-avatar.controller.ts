import {
  Controller,
  Header,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import type { SerializedUser } from '../users/user.serializer.js';
import { AuthTokenGuard, type AuthenticatedRequest } from './auth-token.guard.js';
import { UserAvatarSwagger } from './auth.swagger.js';
import { UserAvatarHandler } from './user-avatar-handler.js';
import { UserAvatarUploadInterceptor } from './user-avatar-upload.interceptor.js';

@ApiTags('Authentication')
@Controller()
export class UserAvatarController {
  constructor(private readonly avatarHandler: UserAvatarHandler) {}

  @Put('user/avatar')
  @UserAvatarSwagger()
  @UseGuards(AuthTokenGuard)
  @UseInterceptors(new UserAvatarUploadInterceptor())
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  uploadAvatar(
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<SerializedUser> {
    return this.avatarHandler.execute(
      request.auth.sub,
      request.auth.token,
      file,
    );
  }
}
