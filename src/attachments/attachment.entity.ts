import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from '../users/user.entity.js';

@Entity({ name: 'attachments' })
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;

  @Column({ name: 'storage_key', unique: true, length: 128 })
  storageKey!: string;

  @Column({ name: 'media_type', length: 127 })
  mediaType!: string;

  @Column({ name: 'byte_size', type: 'integer' })
  byteSize!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
