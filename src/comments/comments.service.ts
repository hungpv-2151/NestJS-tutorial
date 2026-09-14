import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/filters/api-exception.filter.js';
import { PrismaService } from '../database/prisma.service.js';
import { CommentInput } from './comment.dto.js';

const commentInclude = (viewerId?: number) => ({
  author: { select: { username: true, bio: true, image: true, followers: { where: { followerId: viewerId ?? -1 }, select: { followerId: true }, take: 1 } } },
} as const);
type CommentRecord = Prisma.CommentGetPayload<{ include: ReturnType<typeof commentInclude> }>;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(slug: string, viewerId?: number) {
    const article = await this.article(slug);
    const comments = await this.prisma.comment.findMany({ where: { articleId: article.id }, orderBy: { createdAt: 'asc' }, include: commentInclude(viewerId) });
    return { comments: comments.map((comment) => this.serialize(comment, viewerId)) };
  }

  async create(slug: string, authorId: number, input: CommentInput) {
    const article = await this.article(slug);
    try {
      const comment = await this.prisma.comment.create({ data: { body: input.body, authorId, articleId: article.id }, include: commentInclude(authorId) });
      return { comment: this.serialize(comment, authorId) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') await this.article(slug);
      throw error;
    }
  }

  async remove(slug: string, id: number, authorId: number): Promise<void> {
    const article = await this.article(slug);
    const deleted = await this.prisma.comment.deleteMany({ where: { id, articleId: article.id, authorId } });
    if (deleted.count > 0) return;
    const comment = await this.prisma.comment.findUnique({ where: { id }, select: { authorId: true, articleId: true } });
    if (!comment || comment.articleId !== article.id) throw ApiError.notFound('comment');
    throw new ForbiddenException({ errors: { comment: ['forbidden'] } });
  }

  private async article(slug: string) {
    const article = await this.prisma.article.findUnique({ where: { slug }, select: { id: true } });
    if (!article) throw ApiError.notFound('article');
    return article;
  }

  private serialize(comment: CommentRecord, viewerId?: number) {
    return { id: comment.id, body: comment.body, createdAt: comment.createdAt, updatedAt: comment.updatedAt, author: { username: comment.author.username, bio: comment.author.bio, image: comment.author.image, following: viewerId ? comment.author.followers.length > 0 : false } };
  }
}
