import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import {
  COMMENT_BODY_MAX_LENGTH,
  CreateCommentRequestDto,
} from './comment-create.dto.js';

describe('CreateCommentRequestDto', () => {
  it('accepts a non-blank body at the maximum length', async () => {
    const dto = plainToInstance(CreateCommentRequestDto, {
      comment: { body: `x${'y'.repeat(COMMENT_BODY_MAX_LENGTH - 1)}` },
    });

    await expect(
      validate(dto, { forbidNonWhitelisted: true, whitelist: true }),
    ).resolves.toEqual([]);
  });

  it('rejects blank, oversized, and client-supplied author data', async () => {
    const invalidRequests = [
      { comment: { body: ' \t ' } },
      { comment: { body: 'x'.repeat(COMMENT_BODY_MAX_LENGTH + 1) } },
      { comment: { authorId: 'client-id', body: 'Valid body' } },
    ];

    for (const payload of invalidRequests) {
      const dto = plainToInstance(CreateCommentRequestDto, payload);
      await expect(
        validate(dto, { forbidNonWhitelisted: true, whitelist: true }),
      ).resolves.not.toEqual([]);
    }
  });
});
