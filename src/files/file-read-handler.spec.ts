import { NotFoundException, StreamableFile } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { Attachment } from '../attachments/attachment.entity.js';
import { AttachmentAccessPolicy } from '../attachments/attachment-access-policy.js';
import { FileReadHandler } from './file-read-handler.js';

const ATTACHMENT_ID = '22222222-2222-4222-8222-222222222222';

describe('FileReadHandler', () => {
  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ])('returns a %s stream for the owner', async (mediaType, extension) => {
    const bytes = Buffer.from('private image');
    const handler = createHandler(attachment('owner-id', mediaType), {
      read: vi.fn().mockResolvedValue(bytes),
    });

    const file = await handler.execute('owner-id', ATTACHMENT_ID);

    expect(file).toBeInstanceOf(StreamableFile);
    expect(file.getHeaders()).toEqual({
      disposition: `inline; filename="avatar.${extension}"`,
      length: bytes.length,
      type: mediaType,
    });
  });

  it('returns the same not found response for missing and foreign attachments', async () => {
    const missing = createHandler(null, { read: vi.fn() });
    const foreign = createHandler(attachment('another-owner'), {
      read: vi.fn(),
    });

    await expect(
      missing.execute('owner-id', ATTACHMENT_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      foreign.execute('owner-id', ATTACHMENT_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not expose a file when the authenticated username no longer exists', async () => {
    const storage = { read: vi.fn() };
    const handler = createHandler(null, storage, null);

    await expect(
      handler.execute('deleted-user', ATTACHMENT_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.read).not.toHaveBeenCalled();
  });

  it('does not disclose storage paths when the private file is missing', async () => {
    const handler = createHandler(attachment('owner-id'), {
      read: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('ENOENT'), { code: 'ENOENT' }),
        ),
    });

    await expect(
      handler.execute('owner-id', ATTACHMENT_ID),
    ).rejects.toMatchObject({
      status: 404,
      response: { errors: { file: ['not found'] } },
    });
  });
});

function createHandler(
  record: Attachment | null,
  storage: { read: ReturnType<typeof vi.fn> },
  userId: string | null = 'owner-id',
) {
  return new FileReadHandler(
    {
      findByUsername: vi.fn().mockResolvedValue(userId ? { id: userId } : null),
    } as never,
    { findOneBy: vi.fn().mockResolvedValue(record) } as never,
    storage as never,
    new AttachmentAccessPolicy(),
  );
}

function attachment(ownerId: string, mediaType = 'image/png'): Attachment {
  return {
    byteSize: 13,
    id: ATTACHMENT_ID,
    mediaType,
    ownerId,
    storageKey: 'opaque-random-key.png',
  } as Attachment;
}
