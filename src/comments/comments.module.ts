import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

@Module({ imports: [AuthModule, DatabaseModule], controllers: [CommentsController], providers: [CommentsService] })
export class CommentsModule {}
