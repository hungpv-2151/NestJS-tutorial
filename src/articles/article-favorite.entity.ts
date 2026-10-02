import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../users/user.entity.js';
import { Article } from './article.entity.js';

@Entity({ name: 'article_favorites' })
@Index('idx_article_favorites_user_article', ['userId', 'articleId'])
export class ArticleFavorite {
  @PrimaryColumn({
    name: 'article_id',
    type: 'uuid',
    primaryKeyConstraintName: 'pk_article_favorites',
  })
  articleId!: string;

  @PrimaryColumn({
    name: 'user_id',
    type: 'uuid',
    primaryKeyConstraintName: 'pk_article_favorites',
  })
  userId!: string;

  @ManyToOne(() => Article, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'article_id',
    foreignKeyConstraintName: 'fk_article_favorites_article',
  })
  article!: Article;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_article_favorites_user',
  })
  user!: User;
}
