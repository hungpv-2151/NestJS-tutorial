import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
@Injectable()
export class TagsService { constructor(private readonly prisma: PrismaService) {} async list() { const tags = await this.prisma.tag.findMany({ orderBy: { name: 'asc' }, select: { name: true } }); return { tags: tags.map((tag) => tag.name) }; } }
