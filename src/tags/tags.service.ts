import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Tag } from './tag.entity.js';

@Injectable()
export class TagsService {
  constructor(@InjectRepository(Tag) private readonly tags: Repository<Tag>) {}

  async listNames(): Promise<string[]> {
    const tags = await this.tags.find({
      order: { name: 'ASC' },
      select: { name: true },
    });
    return tags.map(({ name }) => name);
  }
}
