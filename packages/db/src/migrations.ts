import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { z } from 'zod';

import type { DatabaseHandle } from './client.js';

/** Resolves to `packages/db/drizzle` from both `src/` (tests) and `dist/` (runtime). */
export function migrationsFolder(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', 'drizzle');
}

const Journal = z.object({
  version: z.string(),
  dialect: z.literal('postgresql'),
  entries: z.array(
    z.object({
      idx: z.number().int().nonnegative(),
      version: z.string(),
      when: z.number().int(),
      tag: z.string(),
      breakpoints: z.boolean(),
    }),
  ),
});
export type MigrationJournal = z.infer<typeof Journal>;

export function readMigrationJournal(): MigrationJournal {
  const raw = readFileSync(resolve(migrationsFolder(), 'meta', '_journal.json'), 'utf8');
  return Journal.parse(JSON.parse(raw));
}

/**
 * Apply committed migrations programmatically. Used by integration tests and by explicit
 * operator commands; never called implicitly at application startup.
 */
export async function runMigrations(handle: DatabaseHandle): Promise<void> {
  await migrate(handle.db, { migrationsFolder: migrationsFolder() });
}
