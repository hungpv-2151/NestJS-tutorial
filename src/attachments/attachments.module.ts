import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Attachment } from './attachment.entity.js';
import { AttachmentAccessPolicy } from './attachment-access-policy.js';
import { PrivateAttachmentStorage } from './private-attachment-storage.js';

@Module({
  imports: [TypeOrmModule.forFeature([Attachment])],
  providers: [
    AttachmentAccessPolicy,
    {
      provide: PrivateAttachmentStorage,
      useFactory: () =>
        new PrivateAttachmentStorage(process.env.ATTACHMENTS_PRIVATE_ROOT),
    },
  ],
  exports: [AttachmentAccessPolicy, PrivateAttachmentStorage, TypeOrmModule],
})
export class AttachmentsModule {}
