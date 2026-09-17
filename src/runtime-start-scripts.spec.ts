import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const START_SCRIPTS = ['start', 'start:debug', 'start:dev', 'start:prod'];
const ENV_FILE_FLAG = '--env-file-if-exists=.env';

describe('runtime start scripts', () => {
  it.each(START_SCRIPTS)('loads .env before running %s', async (name) => {
    const packageJson = await readPackageJson();
    const script = packageJson.scripts[name];

    expect(script.startsWith(`node ${ENV_FILE_FLAG} `)).toBe(true);
    if (name !== 'start:prod') {
      expect(script).toContain("require.resolve('@nestjs/cli/bin/nest.js')");
    }
  });
});

async function readPackageJson(): Promise<{ scripts: Record<string, string> }> {
  const file = new URL('../package.json', import.meta.url);
  return JSON.parse(await readFile(file, 'utf8')) as {
    scripts: Record<string, string>;
  };
}
