import { loadBundledRegistry } from '@isp-search/discovery';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabase, type DatabaseHandle } from './client.js';
import { runMigrations } from './migrations.js';
import {
  importRegistry,
  loadActiveRegistry,
  NoActiveRegistryError,
  RegistryImportError,
  resolveProviderAlias,
} from './registry.js';

const base = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL'];
if (!base) {
  throw new Error('db integration tests need DATABASE_URL_TEST or DATABASE_URL');
}
const adminUrl = new URL(base);
const testDbName = `isp_search_registry_${String(process.pid)}`;
let handle: DatabaseHandle;

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`create database ${testDbName}`);
  await admin.end();
  const url = new URL(base);
  url.pathname = `/${testDbName}`;
  handle = createDatabase({ connectionString: url.toString(), applicationName: 'isp-search-test' });
  await runMigrations(handle);
});

afterAll(async () => {
  await handle.close();
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`drop database if exists ${testDbName} with (force)`);
  await admin.end();
});

describe('registry import', () => {
  it('there is no active registry before any import', async () => {
    await expect(loadActiveRegistry(handle)).rejects.toBeInstanceOf(NoActiveRegistryError);
  });

  it('imports both bundled registries idempotently and keeps exactly one active', async () => {
    const synthetic = loadBundledRegistry('synthetic-dev');
    const proposed = loadBundledRegistry('proposed');
    const first = await importRegistry(handle, synthetic, { activate: true });
    expect(first.markets).toBe(1);
    expect(first.providers).toBe(12);
    const second = await importRegistry(handle, proposed, { activate: false });
    expect(second.markets).toBe(2);
    expect(second.providers).toBe(9);
    // Re-import is idempotent.
    await importRegistry(handle, synthetic, { activate: true });
    await importRegistry(handle, proposed, { activate: false });
    const active = await loadActiveRegistry(handle);
    expect(active.registry_version).toBe(synthetic.registry_version);
    const count = await handle.pool.query(
      'select count(*)::int as n from launch_registry_documents where active',
    );
    expect(count.rows[0]).toEqual({ n: 1 });
  });

  it('activating a different registry swaps the single active flag', async () => {
    const proposed = loadBundledRegistry('proposed');
    await importRegistry(handle, proposed, { activate: true });
    const active = await loadActiveRegistry(handle);
    expect(active.registry_version).toBe(proposed.registry_version);
    // Restore the development default.
    await importRegistry(handle, loadBundledRegistry('synthetic-dev'), { activate: true });
  });

  it('the proposed markets stay proposed after import — never approved by seeding', async () => {
    const rows = await handle.pool.query(
      "select id, status from launch_markets where id in ('cbsa-42660','cbsa-39580') order by id",
    );
    expect(rows.rows).toEqual([
      { id: 'cbsa-39580', status: 'proposed' },
      { id: 'cbsa-42660', status: 'proposed' },
    ]);
  });

  it('resolves registry aliases deterministically', async () => {
    expect(
      await resolveProviderAlias(handle, {
        kind: 'alias',
        sourceType: 'launch_registry',
        value: 'ziply fiber',
      }),
    ).toBe('ziply-fiber');
    expect(
      await resolveProviderAlias(handle, {
        kind: 'source_id',
        sourceType: 'launch_registry',
        value: 'T-MOBILE-HOME-INTERNET',
      }),
    ).toBe('t-mobile-home-internet');
    expect(
      await resolveProviderAlias(handle, {
        kind: 'alias',
        sourceType: 'launch_registry',
        value: 'Unknown ISP LLC',
      }),
    ).toBeUndefined();
  });

  it('an alias claimed by two different providers fails the import instead of auto-merging', async () => {
    const synthetic = loadBundledRegistry('synthetic-dev');
    const market = synthetic.markets[0];
    if (!market) throw new Error('synthetic registry has no market');
    const [a, b] = market.providers;
    if (!a || !b) throw new Error('synthetic registry needs two providers');
    const conflicting = {
      ...synthetic,
      registry_version: 'dev-conflict-test',
      markets: [
        {
          ...market,
          providers: [a, { ...b, display_name: a.display_name }],
        },
      ],
    };
    await expect(importRegistry(handle, conflicting, { activate: false })).rejects.toBeInstanceOf(
      RegistryImportError,
    );
    // The failed import left no document behind (transactional).
    const rows = await handle.pool.query(
      "select 1 from launch_registry_documents where registry_version = 'dev-conflict-test'",
    );
    expect(rows.rowCount).toBe(0);
  });

  it('rejects non-https official URLs', async () => {
    const synthetic = loadBundledRegistry('synthetic-dev');
    const market = synthetic.markets[0];
    if (!market) throw new Error('synthetic registry has no market');
    const [a] = market.providers;
    if (!a) throw new Error('synthetic registry needs a provider');
    const insecure = {
      ...synthetic,
      registry_version: 'dev-insecure-test',
      markets: [{ ...market, providers: [{ ...a, fallback_url: 'http://example.com/insecure' }] }],
    };
    await expect(importRegistry(handle, insecure, { activate: false })).rejects.toThrow(
      /unsafe_url/,
    );
  });

  it('provider directory rows carry approved link hosts and technologies', async () => {
    const rows = await handle.pool.query(
      "select approved_link_hosts, technologies, adapter_support from provider_brands where id = 'brightspeed'",
    );
    const row = rows.rows[0] as {
      approved_link_hosts: string[];
      technologies: string[];
      adapter_support: string;
    };
    expect(row.approved_link_hosts).toContain('shop.brightspeed.com');
    expect(row.technologies).toEqual(['dsl', 'fiber']);
    expect(row.adapter_support).toBe('link_only');
  });
});
