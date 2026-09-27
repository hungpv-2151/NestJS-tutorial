import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'tags' })
@Index('uq_tags_name', ['name'], { unique: true })
export class Tag {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_tags' })
  id!: string;

  @Column({ type: 'text' })
  name!: string;
}
