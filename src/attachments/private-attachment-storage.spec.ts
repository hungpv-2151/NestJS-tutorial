import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  InvalidAttachmentStorageKeyError,
  PrivateAttachmentStorage,
} from './private-attachment-storage.js';

describe('PrivateAttachmentStorage', () => {
  it.each([undefined, '', '   '])(
    'uses the private default root for an empty root configuration',
    (rootPath) => {
      const storage = new PrivateAttachmentStorage(rootPath);

      expect(storage.resolvePath('image.png')).toContain('storage/private');
    },
  );

  it('writes a file only below its configured private root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'attachments-'));
    const storage = new PrivateAttachmentStorage(root);

    await storage.write('random-file.webp', Buffer.from('image'));

    await expect(readFile(join(root, 'random-file.webp'), 'utf8')).resolves.toBe(
      'image',
    );
    expect(() => storage.resolvePath('../outside.webp')).toThrow(
      InvalidAttachmentStorageKeyError,
    );
  });

  it('removes only an attachment file addressed by a valid storage key', async () => {
    const root = await mkdtemp(join(tmpdir(), 'attachments-'));
    const storage = new PrivateAttachmentStorage(root);

    await storage.write('remove-me.png', Buffer.from('image'));
    await storage.remove('remove-me.png');

    await expect(readFile(join(root, 'remove-me.png'))).rejects.toThrow();
  });
});
