import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { Article } from './article.entity.js';
import { Tag } from '../tags/tag.entity.js';

@Entity({ name: 'article_tags' })
@Check('chk_article_tags_position_nonnegative', '"position" >= 0')
@Unique('uq_article_tags_article_position', ['articleId', 'position'])
@Index('idx_article_tags_tag_article', ['tagId', 'articleId'])
export class ArticleTag {
  @PrimaryColumn({
    name: 'article_id',
    type: 'uuid',
    primaryKeyConstraintName: 'pk_article_tags',
  })
  articleId!: string;

  @PrimaryColumn({
    name: 'tag_id',
    type: 'uuid',
    primaryKeyConstraintName: 'pk_article_tags',
  })
  tagId!: string;

  @Column({ type: 'integer' })
  position!: number;

  @ManyToOne(() => Article, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'article_id',
    foreignKeyConstraintName: 'fk_article_tags_article',
  })
  article!: Article;

  @ManyToOne(() => Tag, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'tag_id',
    foreignKeyConstraintName: 'fk_article_tags_tag',
  })
  tag!: Tag;
}
