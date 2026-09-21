import { describe, expect, it } from 'vitest';

import { AttachmentAccessPolicy } from './attachment-access-policy.js';

describe('AttachmentAccessPolicy', () => {
  it('allows only the attachment owner to read a private attachment', () => {
    const policy = new AttachmentAccessPolicy();
    const attachment = { ownerId: 'owner-id' };

    expect(policy.canRead('owner-id', attachment as never)).toBe(true);
    expect(policy.canRead('other-id', attachment as never)).toBe(false);
  });
});
