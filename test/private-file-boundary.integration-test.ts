import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Attachment } from '../src/attachments/attachment.entity.js';
import { AttachmentAccessPolicy } from '../src/attachments/attachment-access-policy.js';
import { PrivateAttachmentStorage } from '../src/attachments/private-attachment-storage.js';
import { FileReadHandler } from '../src/files/file-read-handler.js';
import { UserService } from '../src/users/user.service.js';
import { User } from '../src/users/user.entity.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? it : it.skip;

describe('private file persistence boundary', () => {
  integration(
    'reads persisted owner metadata and stored bytes without disclosure',
    async () => {
      const suffix = randomUUID();
      const root = await mkdtemp(join(tmpdir(), 'private-files-'));
      const storage = new PrivateAttachmentStorage(root);
      const storageKey = `${suffix}.png`;
      const body = Buffer.from('private-image-fixture');
      const dataSource = new DataSource({
        type: 'postgres',
        url: databaseUrl,
        entities: [User, Attachment],
      });
      let owner: User | undefined;
      let viewer: User | undefined;
      let attachment: Attachment | undefined;

      try {
        await dataSource.initialize();
        owner = await createUser(dataSource, `file-owner-${suffix}`);
        viewer = await createUser(dataSource, `file-viewer-${suffix}`);
        await storage.write(storageKey, body);
        attachment = await dataSource.getRepository(Attachment).save({
          ownerId: owner.id,
          storageKey,
          mediaType: 'image/png',
          byteSize: body.byteLength,
        });

        const handler = new FileReadHandler(
          new UserService(dataSource.getRepository(User)),
          dataSource.getRepository(Attachment),
          storage,
          new AttachmentAccessPolicy(),
        );

        await expect(
          handler.execute(owner.username, attachment.id),
        ).resolves.toEqual({
          body,
          byteSize: body.byteLength,
          mediaType: 'image/png',
        });
        const foreignFileError = await getNotFoundError(
          handler.execute(viewer.username, attachment.id),
        );

        await storage.remove(storageKey);
        const missingFileError = await getNotFoundError(
          handler.execute(owner.username, attachment.id),
        );
        const expectedNotFound = { errors: { file: ['not found'] } };

        expect(foreignFileError.getStatus()).toBe(404);
        expect(missingFileError.getStatus()).toBe(404);
        expect(foreignFileError.getResponse()).toEqual(expectedNotFound);
        expect(missingFileError.getResponse()).toEqual(
          foreignFileError.getResponse(),
        );
      } finally {
        try {
          if (dataSource.isInitialized) {
            try {
              if (attachment)
                await dataSource
                  .getRepository(Attachment)
                  .delete({ id: attachment.id });
              if (owner)
                await dataSource.getRepository(User).delete({ id: owner.id });
              if (viewer)
                await dataSource.getRepository(User).delete({ id: viewer.id });
            } finally {
              await dataSource.destroy();
            }
          }
        } finally {
          await rm(root, { recursive: true, force: true });
        }
      }
    },
  );
});

async function createUser(
  dataSource: DataSource,
  username: string,
): Promise<User> {
  return dataSource.getRepository(User).save({
    username,
    email: `${username}@example.test`,
    passwordHash: 'integration-test-only-hash',
  });
}

async function getNotFoundError(
  read: Promise<unknown>,
): Promise<NotFoundException> {
  try {
    await read;
  } catch (error) {
    if (error instanceof NotFoundException) return error;
    throw error;
  }
  throw new Error('Expected private file read to return not found');
}
