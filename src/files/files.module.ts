import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AttachmentsModule } from '../attachments/attachments.module.js';
import { Attachment } from '../attachments/attachment.entity.js';
import { AttachmentAccessPolicy } from '../attachments/attachment-access-policy.js';
import { PrivateAttachmentStorage } from '../attachments/private-attachment-storage.js';
import { AuthModule } from '../auth/auth.module.js';
import { UserService } from '../users/user.service.js';
import { FileReadController } from './file-read.controller.js';
import { FileReadHandler } from './file-read-handler.js';

@Module({
  controllers: [FileReadController],
  imports: [AuthModule, AttachmentsModule],
  providers: [
    {
      inject: [
        DataSource,
        PrivateAttachmentStorage,
        AttachmentAccessPolicy,
        UserService,
      ],
      provide: FileReadHandler,
      useFactory: (
        dataSource: DataSource,
        storage: PrivateAttachmentStorage,
        accessPolicy: AttachmentAccessPolicy,
        users: UserService,
      ) =>
        new FileReadHandler(
          users,
          dataSource.getRepository(Attachment),
          storage,
          accessPolicy,
        ),
    },
  ],
})
export class FilesModule {}
