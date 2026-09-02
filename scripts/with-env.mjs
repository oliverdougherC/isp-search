// Runs a command with the repository .env loaded (if present) into the environment.
// Usage: node scripts/with-env.mjs <command> [args...]
// Uses Node's built-in process.loadEnvFile; no third-party dependency.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(new URL('..', import.meta.url).pathname, '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('usage: with-env <command> [args...]');
  process.exit(2);
}
const result = spawnSync(command, args, { stdio: 'inherit', env: process.env, shell: false });
process.exit(result.status ?? 1);
