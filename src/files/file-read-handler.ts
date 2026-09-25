import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';

import { Attachment } from '../attachments/attachment.entity.js';
import { AttachmentAccessPolicy } from '../attachments/attachment-access-policy.js';
import { PrivateAttachmentStorage } from '../attachments/private-attachment-storage.js';
import { UserService } from '../users/user.service.js';

const MAX_PRIVATE_FILE_BYTES = 2 * 1024 * 1024;
const IMAGE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface PrivateFileContent {
  body: Buffer;
  byteSize: number;
  mediaType: string;
}

@Injectable()
export class FileReadHandler {
  constructor(
    private readonly users: Pick<UserService, 'findByUsername'>,
    private readonly attachments: Pick<Repository<Attachment>, 'findOneBy'>,
    private readonly storage: PrivateAttachmentStorage,
    private readonly accessPolicy: AttachmentAccessPolicy,
  ) {}

  async execute(username: string, attachmentId: string): Promise<PrivateFileContent> {
    if (!UUID_PATTERN.test(attachmentId)) throw fileNotFound();

    const user = await this.users.findByUsername(username);
    if (!user) throw fileNotFound();
    const attachment = await this.attachments.findOneBy({ id: attachmentId });
    if (!attachment || !this.accessPolicy.canRead(user.id, attachment)) {
      throw fileNotFound();
    }
    if (
      !IMAGE_MEDIA_TYPES.has(attachment.mediaType) ||
      attachment.byteSize < 0 ||
      attachment.byteSize > MAX_PRIVATE_FILE_BYTES
    ) {
      throw fileReadFailed();
    }

    let body: Buffer;
    try {
      body = await this.storage.read(attachment.storageKey);
    } catch (error) {
      if (isMissingFile(error)) throw fileNotFound();
      throw fileReadFailed();
    }
    if (body.byteLength !== attachment.byteSize) throw fileReadFailed();

    return { body, byteSize: body.byteLength, mediaType: attachment.mediaType };
  }
}

function fileNotFound(): NotFoundException {
  return new NotFoundException({ errors: { file: ['not found'] } });
}

function fileReadFailed(): InternalServerErrorException {
  return new InternalServerErrorException({
    errors: { file: ['could not be read'] },
  });
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
