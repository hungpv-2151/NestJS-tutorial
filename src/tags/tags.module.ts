import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { TagsController } from './tags.controller.js';
import { TagsService } from './tags.service.js';
@Module({ imports: [DatabaseModule], controllers: [TagsController], providers: [TagsService] }) export class TagsModule {}
