import { Attachment } from './attachment.entity.js';

export class AttachmentAccessPolicy {
  canRead(userId: string, attachment: Attachment): boolean {
    return userId === attachment.ownerId;
  }
}
