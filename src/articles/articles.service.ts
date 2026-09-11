import { ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/filters/api-exception.filter.js';
import { PrismaService } from '../database/prisma.service.js';
import { ArticleInput, ArticleQueryDto, ArticleUpdate } from './article.dto.js';

const articleInclude = (viewerId?: number) => ({
  author: { select: { username: true, bio: true, image: true, followers: { where: { followerId: viewerId ?? -1 }, select: { followerId: true }, take: 1 } } },
  tags: { orderBy: { position: 'asc' }, include: { tag: true } },
  _count: { select: { favorites: true } },
  favorites: { where: { userId: viewerId ?? -1 }, select: { userId: true }, take: 1 },
} as const);
type ArticleRecord = Prisma.ArticleGetPayload<{ include: ReturnType<typeof articleInclude> }>;

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: number, input: ArticleInput) {
    const base = this.slug(input.title);
    for (let retry = 0; retry < 3; retry += 1) {
      const slug = retry === 0 ? base : `${base}-${crypto.randomUUID()}`;
      try {
        const article = await this.prisma.article.create({
          data: { slug, title: input.title, description: input.description, body: input.body, authorId, tags: input.tagList ? { create: input.tagList.map((name, position) => ({ position, tag: { connectOrCreate: { where: { name }, create: { name } } } })) } : undefined },
          include: articleInclude(authorId),
        });
        return { article: this.serialize(article, true, authorId) };
      } catch (error) { if (!this.isSlugConflict(error)) throw error; }
    }
    throw new HttpException({ errors: { article: ['has already been taken'] } }, HttpStatus.CONFLICT);
  }

  async one(slug: string, viewerId?: number) {
    const article = await this.prisma.article.findUnique({ where: { slug }, include: articleInclude(viewerId) });
    if (!article) throw ApiError.notFound('article');
    return { article: this.serialize(article, true, viewerId) };
  }

  async list(query: ArticleQueryDto, viewerId?: number) {
    const where: Prisma.ArticleWhereInput = { ...(query.tag ? { tags: { some: { tag: { name: query.tag } } } } : {}), ...(query.author ? { author: { username: query.author } } : {}), ...(query.favorited ? { favorites: { some: { user: { username: query.favorited } } } } : {}) };
    return this.listWhere(where, query, viewerId);
  }

  async feed(query: ArticleQueryDto, viewerId: number) {
    return this.listWhere({ author: { followers: { some: { followerId: viewerId } } } }, query, viewerId);
  }

  async favorite(slug: string, userId: number, shouldFavorite: boolean) {
    let article: ArticleRecord | null;
    try {
      article = await this.prisma.$transaction(async (tx) => {
        const target = await tx.article.findUnique({ where: { slug }, select: { id: true } });
        if (!target) throw ApiError.notFound('article');
        if (shouldFavorite) {
          await tx.favorite.upsert({ where: { userId_articleId: { userId, articleId: target.id } }, create: { userId, articleId: target.id }, update: {} });
        } else {
          await tx.favorite.deleteMany({ where: { userId, articleId: target.id } });
        }
        return tx.article.findUnique({ where: { slug }, include: articleInclude(userId) });
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2003') throw error;
      const exists = await this.prisma.article.findUnique({ where: { slug }, select: { id: true } });
      if (!exists) throw ApiError.notFound('article');
      throw error;
    }
    if (!article) throw ApiError.notFound('article');
    return { article: this.serialize(article, true, userId) };
  }

  async update(slug: string, authorId: number, input: ArticleUpdate) {
    const article = await this.prisma.$transaction(async (tx) => {
      const scoped = await tx.article.updateMany({ where: { slug, authorId }, data: { title: input.title, description: input.description, body: input.body, updatedAt: new Date() } });
      if (scoped.count === 0) return undefined;
      return tx.article.update({
        where: { slug },
        data: input.tagList === undefined ? {} : { tags: { deleteMany: {}, create: input.tagList.map((name, position) => ({ position, tag: { connectOrCreate: { where: { name }, create: { name } } } })) } },
        include: articleInclude(authorId),
      });
    });
    if (!article) await this.ownershipFailure(slug);
    return { article: this.serialize(article!, true, authorId) };
  }

  async remove(slug: string, authorId: number) {
    const scoped = await this.prisma.article.deleteMany({ where: { slug, authorId } });
    if (scoped.count === 0) await this.ownershipFailure(slug);
  }

  private async listWhere(where: Prisma.ArticleWhereInput, query: ArticleQueryDto, viewerId?: number) {
    const [count, articles] = await this.prisma.$transaction([this.prisma.article.count({ where }), this.prisma.article.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: query.offset, take: query.limit, include: articleInclude(viewerId) })]);
    return { articles: articles.map((article) => this.serialize(article, false, viewerId)), articlesCount: count };
  }

  private slug(title: string): string { return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'article'; }
  private isSlugConflict(error: unknown): boolean { if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false; const target = error.meta?.target; const name = Array.isArray(target) ? target[0] : target; return name === 'slug' || name === 'articles_slug_key'; }
  private async ownershipFailure(slug: string): Promise<never> { const exists = await this.prisma.article.findUnique({ where: { slug }, select: { id: true } }); if (!exists) throw ApiError.notFound('article'); throw new ForbiddenException({ errors: { article: ['forbidden'] } }); }
  private serialize(article: ArticleRecord, detail: boolean, viewerId?: number) { const value = { slug: article.slug, title: article.title, description: article.description, tagList: article.tags.map((item) => item.tag.name), createdAt: article.createdAt, updatedAt: article.updatedAt, favorited: viewerId ? article.favorites.length === 1 : false, favoritesCount: article._count.favorites, author: { username: article.author.username, bio: article.author.bio, image: article.author.image, following: viewerId ? article.author.followers.length > 0 : false } }; return detail ? { ...value, body: article.body } : value; }
}
