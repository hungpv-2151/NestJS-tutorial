import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runDatabaseReset } from './reset-database.js';

function getResetEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const callerConfirmation = environment.CONFIRM_DATABASE_RESET;

  if (!environment.TEST_DATABASE_URL) {
    process.loadEnvFile('.env');
  }

  return {
    ...environment,
    CONFIRM_DATABASE_RESET: callerConfirmation,
  };
}

async function runDatabaseResetRunner(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const resetEnvironment = getResetEnvironment(environment);

  const { getDatabaseResetConfig } = await import(
    './database-reset-config.js'
  );
  const resetConfig = getDatabaseResetConfig(resetEnvironment);
  environment.DATABASE_URL = resetConfig.url;

  const { default: dataSource } = await import('./data-source.js');
  await runDatabaseReset(dataSource, () => resetConfig);
}

function isMainModule(): boolean {
  const invokedPath = process.argv[1];
  return invokedPath
    ? import.meta.url === pathToFileURL(resolve(invokedPath)).href
    : false;
}

if (isMainModule()) {
  await runDatabaseResetRunner().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
