import {
  Injectable,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import { Attachment } from '../attachments/attachment.entity.js';
import { PrivateAttachmentStorage } from '../attachments/private-attachment-storage.js';
import {
  serializeUser,
  type SerializedUser,
} from '../users/user.serializer.js';
import { User } from '../users/user.entity.js';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const JPEG_MEDIA_TYPE = 'image/jpeg';
const PNG_MEDIA_TYPE = 'image/png';
const WEBP_MEDIA_TYPE = 'image/webp';
const WEBP_CONTAINER = 'WEBP';
const RIFF_CONTAINER = 'RIFF';

interface AvatarUpload {
  buffer: Buffer;
  mimetype: string;
}

@Injectable()
export class UserAvatarHandler {
  private readonly logger = new Logger(UserAvatarHandler.name);

  constructor(
    private readonly dataSource: Pick<DataSource, 'transaction'>,
    private readonly storage: PrivateAttachmentStorage,
    private readonly createStorageKey: (
      mediaType: AvatarMediaType,
    ) => string = (mediaType) =>
      `${randomUUID()}.${MEDIA_TYPE_EXTENSION[mediaType]}`,
  ) {}

  async execute(
    username: string,
    token: string,
    upload: AvatarUpload | undefined,
  ): Promise<SerializedUser> {
    const mediaType = getAvatarMediaType(upload?.buffer);
    if (!upload || !mediaType || upload.buffer.byteLength > MAX_AVATAR_BYTES) {
      throw new UnprocessableEntityException({
        errors: { avatar: ['is invalid'] },
      });
    }

    const storageKey = this.createStorageKey(mediaType);
    let storageWriteAttempted = false;
    let cleanupOwnerId: string | undefined;
    try {
      const { user, staleAttachments } = await this.dataSource.transaction(
        async (manager) => {
          const users = manager.getRepository(User);
          const attachments = manager.getRepository(Attachment);
          const currentUser = await users.findOne({
            where: { username },
            lock: { mode: 'pessimistic_write' },
          });
          if (!currentUser) {
            throw new UnauthorizedException({
              errors: { token: ['is invalid'] },
            });
          }
          cleanupOwnerId = currentUser.id;

          const staleAttachments = (await attachments.findBy({
            ownerId: currentUser.id,
          }))
            .map(({ id, storageKey }) => ({ id, storageKey }));

          // The key is unique per upload, so cleanup is safe even if write leaves
          // a partial file before rejecting.
          storageWriteAttempted = true;
          await this.storage.write(storageKey, upload.buffer);
          const attachment = await attachments.save(
            attachments.create({
              byteSize: upload.buffer.byteLength,
              mediaType,
              ownerId: currentUser.id,
              storageKey,
            }),
          );
          currentUser.image = `/api/files/${attachment.id}`;
          return {
            user: await users.save(currentUser),
            staleAttachments,
          };
        },
      );

      for (const avatarToRemove of staleAttachments) {
        try {
          await this.storage.remove(avatarToRemove.storageKey);
          await this.dataSource.transaction(async (manager) => {
            await manager.getRepository(Attachment).delete({
              id: avatarToRemove.id,
              ownerId: user.id,
            });
          });
        } catch (cleanupError) {
          // Keep failed cleanup rows so the next avatar upload can retry them.
          this.logCleanupFailure(cleanupError, 'previous_avatar_cleanup_failed');
        }
      }

      return serializeUser(user, token);
    } catch (error) {
      if (storageWriteAttempted) {
        try {
          await this.storage.remove(storageKey);
        } catch (cleanupError) {
          this.logCleanupFailure(cleanupError, 'avatar_storage_cleanup_failed');
          if (cleanupOwnerId) {
            try {
              await this.dataSource.transaction(async (manager) => {
                await manager.getRepository(Attachment).save(
                  manager.getRepository(Attachment).create({
                    byteSize: upload.buffer.byteLength,
                    mediaType,
                    ownerId: cleanupOwnerId,
                    storageKey,
                  }),
                );
              });
            } catch (markerError) {
              this.logCleanupFailure(markerError, 'avatar_cleanup_marker_failed');
            }
          }
        }
      }
      throw error;
    }
  }

  private logCleanupFailure(error: unknown, category: string): void {
    this.logger.error(
      JSON.stringify({
        category,
        errorCategory: error instanceof Error ? error.name : 'unknown',
      }),
    );
  }
}

type AvatarMediaType =
  | typeof JPEG_MEDIA_TYPE
  | typeof PNG_MEDIA_TYPE
  | typeof WEBP_MEDIA_TYPE;

const MEDIA_TYPE_EXTENSION: Record<AvatarMediaType, string> = {
  [JPEG_MEDIA_TYPE]: 'jpg',
  [PNG_MEDIA_TYPE]: 'png',
  [WEBP_MEDIA_TYPE]: 'webp',
};

function getAvatarMediaType(
  buffer: Buffer | undefined,
): AvatarMediaType | undefined {
  if (!buffer) return undefined;
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return JPEG_MEDIA_TYPE;
  }
  if (buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return PNG_MEDIA_TYPE;
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === RIFF_CONTAINER &&
    buffer.toString('ascii', 8, 12) === WEBP_CONTAINER
  ) {
    return WEBP_MEDIA_TYPE;
  }
  return undefined;
}
