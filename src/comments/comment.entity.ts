import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Article } from '../articles/article.entity.js';
import { User } from '../users/user.entity.js';

@Entity({ name: 'comments' })
@Index('idx_comments_article_created_id', ['articleId', 'createdAt', 'id'])
export class Comment {
  @PrimaryGeneratedColumn('identity', {
    type: 'integer',
    primaryKeyConstraintName: 'pk_comments',
  })
  id!: number;

  @Column({ name: 'article_id', type: 'uuid' })
  articleId!: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @Column({ type: 'text' })
  body!: string;

  @ManyToOne(() => Article, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'article_id',
    foreignKeyConstraintName: 'fk_comments_article',
  })
  article!: Article;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'author_id',
    foreignKeyConstraintName: 'fk_comments_author',
  })
  author!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
