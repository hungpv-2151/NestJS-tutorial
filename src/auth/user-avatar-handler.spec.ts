import { describe, expect, it, vi } from 'vitest';

import { Attachment } from '../attachments/attachment.entity.js';
import { User } from '../users/user.entity.js';
import { UserAvatarHandler } from './user-avatar-handler.js';

describe('UserAvatarHandler', () => {
  it('stores a validated PNG privately and returns its file URL', async () => {
    const manager = createManager();
    const storage = { write: vi.fn(), remove: vi.fn() };
    const handler = new UserAvatarHandler(
      { transaction: (work) => work(manager) } as never,
      storage as never,
      () => 'random.png',
    );

    await expect(
      handler.execute('jane', 'current-token', {
        buffer: png(),
        mimetype: 'text/plain',
      }),
    ).resolves.toEqual({
      user: {
        bio: null,
        email: 'jane@example.com',
        image: '/api/files/attachment-id',
        token: 'current-token',
        username: 'jane',
      },
    });

    expect(storage.write).toHaveBeenCalledWith('random.png', png());
    expect(manager.users.findOne).toHaveBeenCalledWith({
      where: { username: 'jane' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.attachments.save).toHaveBeenCalledWith(
      expect.objectContaining({
        byteSize: 8,
        mediaType: 'image/png',
        ownerId: 'user-id',
        storageKey: 'random.png',
      }),
    );
    expect(storage.remove).toHaveBeenCalledWith('old-avatar.png');
    expect(manager.attachments.delete).toHaveBeenCalledWith({
      id: '11111111-1111-4111-8111-111111111111',
      ownerId: 'user-id',
    });
  });

  it('accepts an avatar whose size is exactly 2 MiB', async () => {
    const manager = createManager();
    const handler = new UserAvatarHandler(
      { transaction: (work) => work(manager) } as never,
      { write: vi.fn(), remove: vi.fn() } as never,
      () => 'boundary.png',
    );
    const buffer = Buffer.concat([png(), Buffer.alloc(2 * 1024 * 1024 - 8)]);

    await expect(
      handler.execute('jane', 'token', { buffer, mimetype: 'image/png' }),
    ).resolves.toMatchObject({ user: { image: '/api/files/attachment-id' } });
  });

  it.each([
    ['fake MIME', Buffer.from('not an image'), 'image/png'],
    ['unsupported image type', Buffer.from('GIF89a'), 'image/gif'],
  ])('rejects %s without writing storage', async (_, buffer, mimetype) => {
    const storage = { write: vi.fn(), remove: vi.fn() };
    const handler = new UserAvatarHandler({} as never, storage as never);

    await expect(
      handler.execute('jane', 'token', { buffer, mimetype }),
    ).rejects.toMatchObject({
      response: { errors: { avatar: ['is invalid'] } },
      status: 422,
    });
    expect(storage.write).not.toHaveBeenCalled();
  });

  it('removes the stored file when the database transaction fails', async () => {
    const storage = { write: vi.fn(), remove: vi.fn() };
    const handler = new UserAvatarHandler(
      {
        transaction: async (work) => {
          await work(createManager());
          throw new Error('database failed');
        },
      } as never,
      storage as never,
      () => 'random.png',
    );

    await expect(
      handler.execute('jane', 'token', { buffer: png(), mimetype: 'image/png' }),
    ).rejects.toThrow('database failed');
    expect(storage.remove).toHaveBeenCalledWith('random.png');
  });

  it('keeps the new avatar when removal of the previous one fails', async () => {
    const manager = createManager();
    const storage = {
      write: vi.fn(),
      remove: vi.fn().mockRejectedValue(new Error('storage unavailable')),
    };
    const handler = new UserAvatarHandler(
      { transaction: (work) => work(manager) } as never,
      storage as never,
      () => 'new-avatar.png',
    );

    await expect(
      handler.execute('jane', 'token', { buffer: png(), mimetype: 'image/png' }),
    ).resolves.toMatchObject({ user: { image: '/api/files/attachment-id' } });
    expect(storage.remove).toHaveBeenCalledOnce();
    expect(storage.remove).toHaveBeenCalledWith('old-avatar.png');
    expect(manager.attachments.delete).not.toHaveBeenCalled();
  });

  it('removes a partial file when storage write rejects', async () => {
    const storage = {
      write: vi.fn().mockRejectedValue(new Error('disk full')),
      remove: vi.fn(),
    };
    const handler = new UserAvatarHandler(
      { transaction: (work) => work(createManager()) } as never,
      storage as never,
      () => 'partial.png',
    );

    await expect(
      handler.execute('jane', 'token', { buffer: png(), mimetype: 'image/png' }),
    ).rejects.toThrow('disk full');
    expect(storage.remove).toHaveBeenCalledWith('partial.png');
  });

  it('records failed partial-file cleanup for a later avatar upload', async () => {
    const manager = createManager();
    const storage = {
      write: vi.fn().mockRejectedValue(new Error('disk full')),
      remove: vi.fn().mockRejectedValue(new Error('storage unavailable')),
    };
    const handler = new UserAvatarHandler(
      { transaction: (work) => work(manager) } as never,
      storage as never,
      () => 'partial.png',
    );

    await expect(
      handler.execute('jane', 'token', { buffer: png(), mimetype: 'image/png' }),
    ).rejects.toThrow('disk full');
    expect(manager.attachments.save).toHaveBeenCalledWith(
      expect.objectContaining({
        byteSize: 8,
        mediaType: 'image/png',
        ownerId: 'user-id',
        storageKey: 'partial.png',
      }),
    );
  });
});

function createManager() {
  const user = {
    bio: null,
    email: 'jane@example.com',
    id: 'user-id',
    image: '/api/files/11111111-1111-4111-8111-111111111111',
    username: 'jane',
  };
  const users = {
    findOne: vi.fn().mockResolvedValue(user),
    save: vi.fn().mockImplementation(async (value) => value),
  };
  const attachments = {
    create: vi.fn((value) => value),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
    findBy: vi.fn().mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        storageKey: 'old-avatar.png',
      },
    ]),
    save: vi.fn().mockResolvedValue({ id: 'attachment-id' }),
  };

  return {
    attachments,
    getRepository: (entity: unknown) =>
      entity === User ? users : entity === Attachment ? attachments : undefined,
    users,
  };
}

function png(): Buffer {
  return Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
}
