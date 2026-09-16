import { MigrationInterface, QueryRunner } from 'typeorm';

const CREATE_PGCRYPTO_EXTENSION = 'CREATE EXTENSION IF NOT EXISTS "pgcrypto"';
const DROP_USERS_TABLE = 'DROP TABLE IF EXISTS "users"';

export class CreateUsers1710000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(CREATE_PGCRYPTO_EXTENSION);
    await queryRunner.query(
      'CREATE TABLE "users" (' +
        '"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), ' +
        '"username" varchar(64) NOT NULL UNIQUE, ' +
        '"email" varchar(254) NOT NULL UNIQUE, ' +
        '"password_hash" varchar(255) NOT NULL, ' +
        '"bio" text, "image" varchar(2048), ' +
        '"created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
        '"updated_at" TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DROP_USERS_TABLE);
  }
}
