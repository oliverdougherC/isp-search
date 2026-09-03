// Runs a command with the repository .env loaded (if present) into the environment.
// Usage: node scripts/with-env.mjs <command> [args...]
// Uses Node's built-in process.loadEnvFile; no third-party dependency.
// Signals sent to this wrapper are forwarded to the child so supervised processes
// (worker, web) shut down gracefully instead of being orphaned.
import { spawn } from 'node:child_process';
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
const child = spawn(command, args, { stdio: 'inherit', env: process.env, shell: false });
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
child.on('exit', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
