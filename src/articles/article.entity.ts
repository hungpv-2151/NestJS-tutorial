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
import { User } from '../users/user.entity.js';

@Entity({ name: 'articles' })
@Index('idx_articles_created_id', ['createdAt', 'id'])
@Index('idx_articles_author_created_id', ['authorId', 'createdAt', 'id'])
@Index('uq_articles_slug', ['slug'], { unique: true })
export class Article {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_articles' })
  id!: string;

  @Column({ type: 'text' })
  slug!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'author_id',
    foreignKeyConstraintName: 'fk_articles_author',
  })
  author!: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
