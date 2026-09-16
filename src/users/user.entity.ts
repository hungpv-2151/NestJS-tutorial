import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 64 })
  username!: string;

  @Column({ unique: true, length: 254 })
  email!: string;

  @Column({ name: 'password_hash', select: false, length: 255 })
  passwordHash!: string;

  @Column({ nullable: true, type: 'text' })
  bio!: string | null;

  @Column({ nullable: true, type: 'varchar', length: 2048 })
  image!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
