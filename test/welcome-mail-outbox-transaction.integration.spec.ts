import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { describe, expect, it } from 'vitest';

import { WelcomeMailOutbox } from '../src/jobs/welcome-mail-outbox.entity.js';
import { User } from '../src/users/user.entity.js';
import { UserRegistrationService } from '../src/users/user-registration.service.js';

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
const integration = databaseUrl ? it : it.skip;

describe('welcome-mail outbox transaction', () => {
  integration('rolls back the registration user when outbox persistence fails', async () => {
    const dataSource = new DataSource({
      entities: [User, WelcomeMailOutbox],
      type: 'postgres',
      url: databaseUrl,
    });
    const suffix = randomUUID();
    const email = `rollback-${suffix}@example.test`;

    await dataSource.initialize();
    try {
      const service = new UserRegistrationService({
        transaction: (work) =>
          dataSource.transaction((manager) =>
            work({
              getRepository: (entity) =>
                entity === User
                  ? manager.getRepository(User)
                  : {
                      create: () => ({}) as WelcomeMailOutbox,
                      save: async () => {
                        throw new Error('outbox persistence failed');
                      },
                    },
            } as never),
          ),
      });

      await expect(
        service.register({
          email,
          password: 'safe-password',
          username: `rollback-${suffix}`,
        }),
      ).rejects.toThrow();

      await expect(
        dataSource.getRepository(User).findOneBy({ email }),
      ).resolves.toBeNull();
    } finally {
      await dataSource.destroy();
    }
  });
});
