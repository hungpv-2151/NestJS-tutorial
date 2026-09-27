import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateArticlesTagsFavorites1710000004000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "articles" (' +
        '"id" uuid CONSTRAINT "pk_articles" PRIMARY KEY DEFAULT gen_random_uuid(), ' +
        '"slug" text NOT NULL CONSTRAINT "uq_articles_slug" UNIQUE, ' +
        '"title" text NOT NULL, "description" text NOT NULL, ' +
        '"body" text NOT NULL, ' +
        '"author_id" uuid NOT NULL, ' +
        '"created_at" timestamptz NOT NULL DEFAULT now(), ' +
        '"updated_at" timestamptz NOT NULL DEFAULT now(), ' +
        'CONSTRAINT "fk_articles_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE)',
    );
    await queryRunner.query(
      'CREATE TABLE "tags" (' +
        '"id" uuid CONSTRAINT "pk_tags" PRIMARY KEY DEFAULT gen_random_uuid(), ' +
        '"name" text NOT NULL CONSTRAINT "uq_tags_name" UNIQUE)',
    );
    await queryRunner.query(
      'CREATE TABLE "article_tags" (' +
        '"article_id" uuid NOT NULL, ' +
        '"tag_id" uuid NOT NULL, ' +
        '"position" integer NOT NULL CONSTRAINT "chk_article_tags_position_nonnegative" CHECK ("position" >= 0), ' +
        'CONSTRAINT "pk_article_tags" PRIMARY KEY ("article_id", "tag_id"), ' +
        'CONSTRAINT "uq_article_tags_article_position" UNIQUE ("article_id", "position"), ' +
        'CONSTRAINT "fk_article_tags_article" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE, ' +
        'CONSTRAINT "fk_article_tags_tag" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE)',
    );
    await queryRunner.query(
      'CREATE TABLE "article_favorites" (' +
        '"article_id" uuid NOT NULL, "user_id" uuid NOT NULL, ' +
        'CONSTRAINT "pk_article_favorites" PRIMARY KEY ("article_id", "user_id"), ' +
        'CONSTRAINT "fk_article_favorites_article" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE, ' +
        'CONSTRAINT "fk_article_favorites_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_articles_created_id" ON "articles" ("created_at" DESC, "id" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_articles_author_created_id" ON "articles" ("author_id", "created_at" DESC, "id" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_article_tags_tag_article" ON "article_tags" ("tag_id", "article_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_article_favorites_user_article" ON "article_favorites" ("user_id", "article_id")',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "article_favorites"');
    await queryRunner.query('DROP TABLE IF EXISTS "article_tags"');
    await queryRunner.query('DROP TABLE IF EXISTS "tags"');
    await queryRunner.query('DROP TABLE IF EXISTS "articles"');
  }
}
