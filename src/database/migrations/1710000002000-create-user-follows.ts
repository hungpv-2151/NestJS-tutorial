import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserFollows1710000002000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "user_follows" (' +
        '"follower_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, ' +
        '"following_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, ' +
        'PRIMARY KEY ("follower_id", "following_id"), ' +
        'CHECK ("follower_id" <> "following_id"))',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "user_follows"');
  }
}
