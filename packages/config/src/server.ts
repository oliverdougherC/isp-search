import { parseEnv, type EnvSource } from './load.js';
import {
  TestEnvSchema,
  WebServerEnvSchema,
  WorkerEnvSchema,
  type TestEnv,
  type WebServerEnv,
  type WorkerEnv,
} from './schemas.js';

/**
 * Throws when executed in a browser-like runtime. This is a defence-in-depth check behind the
 * `browser` export condition: bundlers that honour the condition never reach this code, and
 * anything that ignores it fails loudly instead of leaking configuration.
 */
export function assertServerRuntime(moduleName: string): void {
  const globalRecord = globalThis as Record<string, unknown>;
  if (
    typeof globalRecord['window'] !== 'undefined' ||
    typeof globalRecord['document'] !== 'undefined'
  ) {
    throw new Error(`${moduleName} is server-only and must not run in a browser context.`);
  }
}

assertServerRuntime('@isp-search/config/server');

export function loadWebServerEnv(source: EnvSource = process.env): WebServerEnv {
  return parseEnv('web', WebServerEnvSchema, source);
}

export function loadWorkerEnv(source: EnvSource = process.env): WorkerEnv {
  return parseEnv('worker', WorkerEnvSchema, source);
}

export function loadTestEnv(source: EnvSource = process.env): TestEnv {
  return parseEnv('test', TestEnvSchema, source);
}

export { ConfigValidationError, parseEnv } from './load.js';
export type { EnvSource } from './load.js';
export {
  NodeEnv,
  SECRET_ENV_NAMES,
  TestEnvSchema,
  WebServerEnvSchema,
  WorkerEnvSchema,
  type TestEnv,
  type WebServerEnv,
  type WorkerEnv,
} from './schemas.js';
