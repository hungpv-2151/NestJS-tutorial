import {
  Controller,
  Get,
  Header,
  Param,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
  AuthTokenGuard,
  type AuthenticatedRequest,
} from '../auth/auth-token.guard.js';
import { FileReadSwagger } from './files.swagger.js';
import { FileReadHandler } from './file-read-handler.js';

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
  readFile(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<StreamableFile> {
    return this.fileReadHandler.execute(request.auth.sub, id);
  }
}
