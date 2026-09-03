import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LaunchRegistry } from './registry-schema.js';

/**
 * Bundled registry snapshots. These files are seed/review input, validated on load:
 *  - `proposed`: the Route C launch matrix from M0. Its markets are PROPOSED, not
 *    maintainer-approved; loading it never makes them approved.
 *  - `synthetic-dev`: the deterministic development/test registry (synthetic market only).
 */
export type BundledRegistryName = 'proposed' | 'synthetic-dev';

export function loadBundledRegistry(name: BundledRegistryName): LaunchRegistry {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'registry', `${name}.json`);
  const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return LaunchRegistry.parse(raw);
}
