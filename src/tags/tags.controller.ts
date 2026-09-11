import { Controller, Get } from '@nestjs/common';
import { TagsService } from './tags.service.js';
@Controller('tags') export class TagsController { constructor(private readonly tags: TagsService) {} @Get() list() { return this.tags.list(); } }
