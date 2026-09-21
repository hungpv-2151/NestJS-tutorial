import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttachments1710000003000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "attachments" (' +
        '"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), ' +
        '"owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, ' +
        '"storage_key" varchar(128) NOT NULL UNIQUE, ' +
        '"media_type" varchar(127) NOT NULL, ' +
        '"byte_size" integer NOT NULL CHECK ("byte_size" >= 0), ' +
        '"created_at" timestamptz NOT NULL DEFAULT now())',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_attachments_owner_id" ON "attachments" ("owner_id")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "attachments"');
  }
}
