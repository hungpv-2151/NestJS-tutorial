import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ArticlesController } from './articles.controller.js';
import { ArticlesService } from './articles.service.js';
@Module({ imports: [AuthModule, DatabaseModule], controllers: [ArticlesController], providers: [ArticlesService] }) export class ArticlesModule {}
