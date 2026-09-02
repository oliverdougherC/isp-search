/**
 * Public entry: only browser-safe values live here. Server configuration is exported from
 * `@isp-search/config/server`, which the `browser` export condition maps to a module that throws.
 */
import { parseEnv, type EnvSource } from './load.js';
import { PublicEnvSchema, type PublicEnv } from './schemas.js';

export function loadPublicEnv(source: EnvSource): PublicEnv {
  return parseEnv('public', PublicEnvSchema, source);
}

export { PublicEnvSchema, type PublicEnv } from './schemas.js';
export { ConfigValidationError } from './load.js';
export type { EnvSource } from './load.js';
