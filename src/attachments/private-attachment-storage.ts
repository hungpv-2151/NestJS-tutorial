import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, resolve, sep } from 'node:path';

export class InvalidAttachmentStorageKeyError extends Error {
  constructor() {
    super('Attachment storage key is invalid');
  }
}

export class PrivateAttachmentStorage {
  private readonly root: string;

  constructor(rootPath = 'storage/private') {
    this.root = resolve(rootPath.trim() || 'storage/private');
  }

  async write(storageKey: string, content: Buffer): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.resolvePath(storageKey), content, { flag: 'wx' });
  }

  async remove(storageKey: string): Promise<void> {
    await rm(this.resolvePath(storageKey), { force: true });
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(this.resolvePath(storageKey));
  }

  resolvePath(storageKey: string): string {
    if (!storageKey || basename(storageKey) !== storageKey) {
      throw new InvalidAttachmentStorageKeyError();
    }

    const filePath = resolve(this.root, storageKey);
    if (!filePath.startsWith(`${this.root}${sep}`)) {
      throw new InvalidAttachmentStorageKeyError();
    }

    return filePath;
  }
}
