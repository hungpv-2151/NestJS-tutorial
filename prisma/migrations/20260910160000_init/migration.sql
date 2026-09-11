-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "users" (
    "id" SERIAL NOT NULL, "username" TEXT NOT NULL, "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL, "bio" TEXT, "image" TEXT,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "articles" (
    "id" SERIAL NOT NULL, "slug" TEXT NOT NULL, "title" TEXT NOT NULL,
    "description" TEXT NOT NULL, "body" TEXT NOT NULL, "author_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "comments" (
    "id" SERIAL NOT NULL, "body" TEXT NOT NULL, "author_id" INTEGER NOT NULL,
    "article_id" INTEGER NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL, CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "tags" ("id" SERIAL NOT NULL, "name" TEXT NOT NULL, CONSTRAINT "tags_pkey" PRIMARY KEY ("id"));
CREATE TABLE "article_tags" ("article_id" INTEGER NOT NULL, "tag_id" INTEGER NOT NULL, "position" INTEGER NOT NULL, CONSTRAINT "article_tags_pkey" PRIMARY KEY ("article_id", "tag_id"));
CREATE TABLE "follows" ("follower_id" INTEGER NOT NULL, "following_id" INTEGER NOT NULL, CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id", "following_id"));
CREATE TABLE "favorites" ("user_id" INTEGER NOT NULL, "article_id" INTEGER NOT NULL, CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id", "article_id"));

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");
CREATE INDEX "articles_created_at_id_idx" ON "articles"("created_at" DESC, "id" DESC);
CREATE INDEX "articles_author_id_created_at_idx" ON "articles"("author_id", "created_at" DESC);
CREATE INDEX "comments_article_id_created_at_idx" ON "comments"("article_id", "created_at");
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");
CREATE UNIQUE INDEX "article_tags_article_id_position_key" ON "article_tags"("article_id", "position");
CREATE INDEX "article_tags_tag_id_article_id_idx" ON "article_tags"("tag_id", "article_id");
CREATE INDEX "follows_following_id_follower_id_idx" ON "follows"("following_id", "follower_id");
CREATE INDEX "favorites_article_id_user_id_idx" ON "favorites"("article_id", "user_id");

ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "article_tags" ADD CONSTRAINT "article_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
