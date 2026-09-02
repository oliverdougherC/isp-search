import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabase, type DatabaseHandle } from './client.js';
import { checkDatabaseHealth, checkDatabaseReadiness } from './health.js';
import { runMigrations } from './migrations.js';
import { providerBrands } from './schema/index.js';
import { REFERENCE_PROVIDER_SEED, seedReferenceProviders } from './seed.js';

/**
 * Migration verification: migrations apply to an EMPTY database deterministically, readiness
 * reflects pending vs applied state, and seeding is idempotent. Uses a throwaway database.
 */
const base = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL'];
if (!base) {
  throw new Error('db integration tests need DATABASE_URL_TEST or DATABASE_URL');
}
const adminUrl = new URL(base);
const testDbName = `isp_search_mig_${String(process.pid)}`;
let handle: DatabaseHandle;

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`create database ${testDbName}`);
  await admin.end();
  const url = new URL(base);
  url.pathname = `/${testDbName}`;
  handle = createDatabase({ connectionString: url.toString(), applicationName: 'isp-search-test' });
});

afterAll(async () => {
  await handle.close();
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`drop database if exists ${testDbName} with (force)`);
  await admin.end();
});

describe('migrations on an empty database', () => {
  it('is healthy but not ready before migrations', async () => {
    expect((await checkDatabaseHealth(handle)).status).toBe('ok');
    const readiness = await checkDatabaseReadiness(handle);
    expect(readiness.status).toBe('not_ready');
    expect(readiness.checks.migrations.status).toBe('error');
  });

  it('applies committed migrations and becomes ready; re-running is a no-op', async () => {
    await runMigrations(handle);
    const first = await checkDatabaseReadiness(handle);
    expect(first.status).toBe('ready');
    expect(first.checks.migrations.applied).toBe(first.checks.migrations.expected);
    await runMigrations(handle);
    const second = await checkDatabaseReadiness(handle);
    expect(second.checks.migrations.applied).toBe(first.checks.migrations.applied);
  });

  it('seeds reference providers idempotently and enforces the slug constraint', async () => {
    expect(await seedReferenceProviders(handle)).toBe(REFERENCE_PROVIDER_SEED.length);
    expect(await seedReferenceProviders(handle)).toBe(REFERENCE_PROVIDER_SEED.length);
    const rows = await handle.db.select().from(providerBrands);
    expect(rows).toHaveLength(REFERENCE_PROVIDER_SEED.length);
    const failure: unknown = await handle.db
      .insert(providerBrands)
      .values({ id: 'Bad Slug!', displayName: 'x' })
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(failure).toBeInstanceOf(Error);
    const cause = (failure as { cause?: { message?: string } }).cause;
    expect(cause?.message ?? '').toContain('provider_brands_id_slug');
  });
});
