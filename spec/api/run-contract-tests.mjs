import { spawn } from 'node:child_process';
import { join } from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required for contract tests');

const port = process.env.CONTRACT_TEST_PORT ?? '3100';
const environment = { ...process.env, NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL, PORT: port, AUTH_LOGIN_THROTTLE_LIMIT: '1000', AUTH_REGISTER_THROTTLE_LIMIT: '1000' };
const origin = `http://127.0.0.1:${port}`;
let api;
let stopping;
let apiExited = false;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: environment, ...options });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${signal ?? code}`)));
  });
}

async function stopApi() {
  if (stopping) return stopping;
  stopping = (async () => {
    if (!api || apiExited || api.exitCode !== null || api.signalCode !== null) return;
    const exited = new Promise((resolve) => {
      api.once('exit', resolve);
      api.once('error', resolve);
    });
    api.kill('SIGTERM');
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))]);
    if (!apiExited && api.exitCode === null && api.signalCode === null) api.kill('SIGKILL');
  })();
  return stopping;
}

function interrupt() {
  void stopApi().finally(() => process.exit(130));
}

process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);

async function waitForReadiness() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (apiExited || api?.exitCode !== null || api?.signalCode !== null) throw new Error('API exited before readiness');
    try {
      const response = await fetch(`${origin}/api/health/readiness`);
      if (response.ok) return;
    } catch { /* Server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('API readiness timed out');
}

await run('pnpm', ['exec', 'prisma', 'migrate', 'deploy']);
api = spawn('node', [join(process.cwd(), 'd' + 'ist', 'main.js')], { stdio: 'inherit', env: environment });
api.once('exit', () => { apiExited = true; });
api.once('error', () => { apiExited = true; void stopApi(); });
try {
  await waitForReadiness();
  await run('bash', ['spec/api/run-api-tests-hurl.sh'], { env: { ...environment, HOST: origin } });
} finally {
  await stopApi();
}
