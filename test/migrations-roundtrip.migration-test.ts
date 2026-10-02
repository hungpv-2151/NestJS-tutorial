import { randomUUID } from 'node:crypto';
import { DataSource, type QueryRunner } from 'typeorm';
import { CreateUsers1710000000000 } from '../src/database/migrations/1710000000000-create-users.js';
import { CreateWelcomeMailOutbox1710000001000 } from '../src/database/migrations/1710000001000-create-welcome-mail-outbox.js';
import { CreateUserFollows1710000002000 } from '../src/database/migrations/1710000002000-create-user-follows.js';
import { CreateAttachments1710000003000 } from '../src/database/migrations/1710000003000-create-attachments.js';
import { CreateArticlesTagsFavorites1710000004000 } from '../src/database/migrations/1710000004000-create-articles-tags-favorites.js';
import { CreateComments1710000005000 } from '../src/database/migrations/1710000005000-create-comments.js';

const integration = process.env.TEST_DATABASE_URL ? it : it.skip;
const migrations = [
  CreateUsers1710000000000,
  CreateWelcomeMailOutbox1710000001000,
  CreateUserFollows1710000002000,
  CreateAttachments1710000003000,
  CreateArticlesTagsFavorites1710000004000,
  CreateComments1710000005000,
];
const applicationTables = [
  'users',
  'welcome_mail_outbox',
  'user_follows',
  'attachments',
  'articles',
  'tags',
  'article_tags',
  'article_favorites',
  'comments',
];

describe('PostgreSQL migrations integration', () => {
  integration(
    'applies, reverts, and reapplies the registered migrations',
    async () => {
      const schema = `migration_test_${randomUUID().replaceAll('-', '')}`;
      const dataSource = new DataSource({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        migrations,
        synchronize: false,
      });
      let queryRunner: QueryRunner | undefined;

      try {
        await dataSource.initialize();
        queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.query('SET search_path TO public');
        await queryRunner.startTransaction();
        await queryRunner.query(`CREATE SCHEMA "${schema}"`);
        await queryRunner.query(`SET LOCAL search_path TO "${schema}"`);
        await expectCurrentSchema(queryRunner, schema);

        for (const Migration of migrations)
          await new Migration().up(queryRunner);
        await expectTables(queryRunner, schema, applicationTables);

        const lastMigration = migrations[migrations.length - 1];
        await new lastMigration().down(queryRunner);
        await expectTables(queryRunner, schema, applicationTables.slice(0, -1));

        for (const Migration of [...migrations].slice(0, -1).reverse()) {
          await new Migration().down(queryRunner);
        }
        await expectTables(queryRunner, schema, []);

        for (const Migration of migrations)
          await new Migration().up(queryRunner);
        await expectTables(queryRunner, schema, applicationTables);
      } finally {
        try {
          if (queryRunner?.isTransactionActive) {
            await queryRunner.rollbackTransaction();
          }
        } finally {
          await queryRunner?.release();
          if (dataSource.isInitialized) await dataSource.destroy();
        }
      }
    },
    30_000,
  );
});

async function expectTables(
  queryRunner: QueryRunner,
  schema: string,
  expectedTables: string[],
): Promise<void> {
  const rows: Array<{ table_name: string }> = await queryRunner.query(
    'SELECT table_name FROM information_schema.tables WHERE table_schema = $1',
    [schema],
  );
  const applicationTableNames = rows
    .map((row) => row.table_name)
    .filter((name) => name !== 'migrations');

  expect(applicationTableNames).toEqual(expect.arrayContaining(expectedTables));
  expect(applicationTableNames).toHaveLength(expectedTables.length);
}

async function expectCurrentSchema(
  queryRunner: QueryRunner,
  schema: string,
): Promise<void> {
  expect(await getCurrentSchema(queryRunner)).toBe(schema);
}

async function getCurrentSchema(
  queryRunner: QueryRunner,
): Promise<string | null> {
  const [row]: Array<{ current_schema: string | null }> =
    await queryRunner.query('SELECT current_schema()');
  return row.current_schema;
}
