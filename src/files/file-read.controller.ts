import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AuthTokenGuard, type AuthenticatedRequest } from '../auth/auth-token.guard.js';
import { FileReadSwagger } from './files.swagger.js';
import { FileReadHandler } from './file-read-handler.js';
import type { PrivateFileContent } from './file-read-handler.js';

const MEDIA_TYPE_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@ApiTags('Files')
@Controller('files')
export class FileReadController {
  constructor(private readonly fileReadHandler: FileReadHandler) {}

  @Get(':id')
  @FileReadSwagger()
  @UseGuards(AuthTokenGuard)
  @Header('Cache-Control', 'private, no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @Header('X-Content-Type-Options', 'nosniff')
  async readFile(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    const content = await this.fileReadHandler.execute(request.auth.sub, id);
    return toStreamableFile(content);
  }
}

function toStreamableFile(content: PrivateFileContent): StreamableFile {
  const extension = MEDIA_TYPE_EXTENSION[content.mediaType];
  if (!extension) {
    throw new NotFoundException({ errors: { file: ['not found'] } });
  }

  return new StreamableFile(content.body, {
    disposition: `inline; filename="avatar.${extension}"`,
    length: content.byteSize,
    type: content.mediaType,
  });
}
