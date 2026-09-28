import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { GetTagsSwagger } from './tags.swagger.js';
import { TagsService } from './tags.service.js';

@ApiTags('Tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @GetTagsSwagger()
  async list() {
    return { tags: await this.tagsService.listNames() };
  }
}
