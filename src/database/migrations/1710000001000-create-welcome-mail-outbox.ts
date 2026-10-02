import { MigrationInterface, QueryRunner } from 'typeorm';

const DROP_OUTBOX_TABLE = 'DROP TABLE IF EXISTS "welcome_mail_outbox"';

export class CreateWelcomeMailOutbox1710000001000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "welcome_mail_outbox" (' +
        '"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), ' +
        '"user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE, ' +
        '"email" varchar(254) NOT NULL, "username" varchar(64) NOT NULL, ' +
        '"status" varchar(16) NOT NULL DEFAULT \'pending\', ' +
        '"attempt_count" integer NOT NULL DEFAULT 0, ' +
        '"available_at" TIMESTAMPTZ NOT NULL DEFAULT now(), ' +
        '"lease_owner" uuid, "lease_expires_at" TIMESTAMPTZ, ' +
        '"dispatched_at" TIMESTAMPTZ, ' +
        '"created_at" TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    await queryRunner.query(
      'CREATE INDEX "welcome_mail_outbox_pending_ready_idx" ' +
        'ON "welcome_mail_outbox" ("available_at") ' +
        'WHERE "dispatched_at" IS NULL AND "lease_expires_at" IS NULL',
    );
    await queryRunner.query(
      'CREATE INDEX "welcome_mail_outbox_lease_expired_idx" ' +
        'ON "welcome_mail_outbox" ("lease_expires_at") ' +
        'WHERE "dispatched_at" IS NULL AND "lease_expires_at" IS NOT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DROP_OUTBOX_TABLE);
  }
}
