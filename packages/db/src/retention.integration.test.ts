import { randomBytes } from 'node:crypto';

import type { ResolvedAddress } from '@isp-search/domain';
import { CANARIES } from '@isp-search/observability/test-support';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openAddressMaterial } from './address-material.js';
import { createDatabase, type DatabaseHandle } from './client.js';
import { runMigrations } from './migrations.js';
import { deleteRawAddressIfAllSettled, newSweepRunId, sweepRetention } from './retention.js';
import { addressOffers, qualificationJobs, retentionEvents } from './schema/index.js';
import { seedReferenceProviders } from './seed.js';
import { createSearchSession, getSearch, isSearchExpired, type SessionPolicy } from './sessions.js';

/**
 * Retention behavior proofs (PLA-362, ADR-007): early deletion at job completion, TTL sweeps,
 * display-tier wiping, idempotency, and canary absence after expiry.
 */
const base = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL'];
if (!base) {
  throw new Error('db integration tests need DATABASE_URL_TEST or DATABASE_URL');
}
const adminUrl = new URL(base);
const testDbName = `isp_search_retention_${String(process.pid)}`;
let handle: DatabaseHandle;

const hmacKey = { version: 1, secret: randomBytes(32).toString('hex') };
const rawKey = { version: 1, secretHex: randomBytes(32).toString('hex') };

const policy: SessionPolicy = {
  hmacKey,
  rawAddressKey: rawKey,
  rawAddressTtlMinutes: 30,
  searchTtlMinutes: 60,
  deadlineSeconds: 40,
  consentVersion: 'test-1',
};

/** A resolution around the recognizable canary address (never committed as a fixture). */
function canaryResolved(): ResolvedAddress {
  return {
    schemaVersion: 1,
    address: {
      line1: CANARIES.streetLine,
      unit: CANARIES.unit,
      city: 'Fixtureville',
      region: 'ZZ',
      postalCode: '00042',
      country: 'US',
    },
    precision: 'subpremise',
    validationState: 'validated',
    scope: { region: 'ZZ', countyFips: null, cbsaGeoid: 'synthetic-zz' },
    coordinates: null,
    resolverId: 'synthetic',
    resolverVersion: '1.0.0',
    resolvedAt: new Date().toISOString(),
    restrictions: { storagePermitted: true, permittedUntil: null, coordinatesPermitted: false },
    candidates: [],
    unitOptions: [],
  };
}

const NOW = new Date('2026-09-03T12:00:00.000Z');

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`create database ${testDbName}`);
  await admin.end();
  const url = new URL(base);
  url.pathname = `/${testDbName}`;
  handle = createDatabase({ connectionString: url.toString(), applicationName: 'isp-search-test' });
  await runMigrations(handle);
  await seedReferenceProviders(handle);
});

afterAll(async () => {
  await handle.close();
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`drop database if exists ${testDbName} with (force)`);
  await admin.end();
});

describe('search session creation', () => {
  it('stores the address only as HMAC identity, display tier, and decryptable ciphertext', async () => {
    const created = await createSearchSession(handle.db, {
      resolved: canaryResolved(),
      policy,
      now: NOW,
    });
    expect(created.searchId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = await getSearch(handle.db, created.searchId);
    if (!row) throw new Error('search row missing');
    expect(row.addressIdentity).toMatch(/^v1:[0-9a-f]{64}$/);
    expect(row.displayAddress).toContain(CANARIES.streetLine);
    const [material] = await handle.pool
      .query('select ciphertext, key_version from search_address_material where search_id = $1', [
        created.searchId,
      ])
      .then((r) => r.rows as { ciphertext: Buffer; key_version: number }[]);
    if (!material) throw new Error('material row missing');
    // Ciphertext does not contain the plaintext address.
    expect(material.ciphertext.toString('latin1')).not.toContain(CANARIES.streetLine);
    const opened = openAddressMaterial(material.ciphertext, material.key_version, rawKey);
    expect(opened.resolved.address.line1).toBe(CANARIES.streetLine);
    expect(opened.resolved.address.unit).toBe(CANARIES.unit);
  });
});

describe('early deletion at job completion', () => {
  async function sessionWithJobs(
    states: readonly ('queued' | 'running' | 'succeeded' | 'degraded' | 'failed_terminal')[],
  ): Promise<string> {
    const created = await createSearchSession(handle.db, {
      resolved: canaryResolved(),
      policy,
      now: NOW,
    });
    for (const [i, state] of states.entries()) {
      await handle.db.insert(qualificationJobs).values({
        searchId: created.searchId,
        providerId: 'reference-available',
        adapterVersion: `ret-${String(i)}.0.0`,
        state,
      });
    }
    return created.searchId;
  }

  it('keeps the raw address while any job is unsettled', async () => {
    const searchId = await sessionWithJobs(['succeeded', 'running']);
    const deleted = await deleteRawAddressIfAllSettled(handle.db, searchId, {
      sweepRunId: newSweepRunId(),
      now: NOW,
    });
    expect(deleted).toBe(false);
    const rows = await handle.pool.query(
      'select 1 from search_address_material where search_id = $1',
      [searchId],
    );
    expect(rows.rowCount).toBe(1);
  });

  it('deletes the raw address when every job settled (success and failure alike) and audits it', async () => {
    const searchId = await sessionWithJobs(['succeeded', 'degraded', 'failed_terminal']);
    const deleted = await deleteRawAddressIfAllSettled(handle.db, searchId, {
      sweepRunId: 'sweep_test_1',
      now: NOW,
    });
    expect(deleted).toBe(true);
    const rows = await handle.pool.query(
      'select 1 from search_address_material where search_id = $1',
      [searchId],
    );
    expect(rows.rowCount).toBe(0);
    const audit = await handle.pool.query(
      "select data_class, deleted_count, trigger from retention_events where search_id = $1 and sweep_run_id = 'sweep_test_1'",
      [searchId],
    );
    expect(audit.rows).toEqual([
      { data_class: 'raw_address', deleted_count: 1, trigger: 'job_completion' },
    ]);
    // Idempotent: a second call deletes nothing and writes no second audit row.
    const again = await deleteRawAddressIfAllSettled(handle.db, searchId, {
      sweepRunId: 'sweep_test_2',
      now: NOW,
    });
    expect(again).toBe(true);
    const audit2 = await handle.pool.query(
      "select 1 from retention_events where search_id = $1 and sweep_run_id = 'sweep_test_2'",
      [searchId],
    );
    expect(audit2.rowCount).toBe(0);
  });

  it('does not delete for a search with no jobs yet', async () => {
    const created = await createSearchSession(handle.db, {
      resolved: canaryResolved(),
      policy,
      now: NOW,
    });
    const deleted = await deleteRawAddressIfAllSettled(handle.db, created.searchId, {
      sweepRunId: newSweepRunId(),
      now: NOW,
    });
    expect(deleted).toBe(false);
  });
});

describe('scheduled sweep', () => {
  it('sweeps expired material even when a crashed worker left jobs running (hard ceiling)', async () => {
    const created = await createSearchSession(handle.db, {
      resolved: canaryResolved(),
      policy: { ...policy, rawAddressTtlMinutes: 1 },
      now: NOW,
    });
    await handle.db.insert(qualificationJobs).values({
      searchId: created.searchId,
      providerId: 'reference-timeout',
      adapterVersion: 'crash-1.0.0',
      state: 'running',
    });
    const later = new Date(NOW.getTime() + 2 * 60_000);
    const summary = await sweepRetention(handle.db, later);
    expect(summary.failures).toEqual([]);
    expect(summary.rawAddressRows).toBeGreaterThanOrEqual(1);
    const rows = await handle.pool.query(
      'select 1 from search_address_material where search_id = $1',
      [created.searchId],
    );
    expect(rows.rowCount).toBe(0);
  });

  it('wipes display data at search expiry, expires non-terminal searches, and leaves no canary column', async () => {
    const created = await createSearchSession(handle.db, {
      resolved: canaryResolved(),
      policy: { ...policy, searchTtlMinutes: 1, rawAddressTtlMinutes: 1 },
      now: NOW,
    });
    const later = new Date(NOW.getTime() + 5 * 60_000);
    const summary = await sweepRetention(handle.db, later);
    expect(summary.failures).toEqual([]);
    const row = await getSearch(handle.db, created.searchId);
    if (!row) throw new Error('search row missing');
    expect(row.state).toBe('expired');
    expect(isSearchExpired(row, later)).toBe(true);
    // Full-row canary scan over everything the sweep was responsible for: every EXPIRED
    // search row (unexpired searches legitimately hold display data until their TTL), all
    // remaining raw material, audit rows, and job rows.
    const scans: readonly [string, string][] = [
      [
        'searches (expired)',
        `select coalesce(string_agg(t::text, ''), '') as blob from searches t where t.expires_at <= '${later.toISOString()}'`,
      ],
      [
        'search_address_material',
        `select coalesce(string_agg(t.search_id, ''), '') as blob from search_address_material t where t.expires_at <= '${later.toISOString()}'`,
      ],
      [
        'retention_events',
        `select coalesce(string_agg(t::text, ''), '') as blob from retention_events t`,
      ],
      [
        'qualification_jobs',
        `select coalesce(string_agg(t::text, ''), '') as blob from qualification_jobs t`,
      ],
    ];
    for (const [label, query] of scans) {
      const dump = await handle.pool.query(query);
      const blob = (dump.rows[0] as { blob: string }).blob;
      expect(blob, label).not.toContain(CANARIES.streetLine);
      expect(blob, label).not.toContain(CANARIES.unit);
    }
  });

  it('sweeps expired offers and is idempotent across runs', async () => {
    const created = await createSearchSession(handle.db, {
      resolved: canaryResolved(),
      policy,
      now: NOW,
    });
    const [job] = await handle.db
      .insert(qualificationJobs)
      .values({
        searchId: created.searchId,
        providerId: 'reference-available',
        adapterVersion: 'offer-1.0.0',
        state: 'succeeded',
      })
      .returning();
    if (!job) throw new Error('job insert returned nothing');
    await handle.db.insert(addressOffers).values({
      searchId: created.searchId,
      providerId: 'reference-available',
      jobId: job.id,
      adapterVersion: 'offer-1.0.0',
      offerKey: 'k',
      offer: { kind: 'address_offer' },
      addressIdentity: 'v1:00',
      addressIdentityVersion: 1,
      retrievedAt: NOW,
      expiresAt: new Date(NOW.getTime() + 60_000),
    });
    const later = new Date(NOW.getTime() + 10 * 60_000);
    const first = await sweepRetention(handle.db, later);
    expect(first.deletedOffers).toBeGreaterThanOrEqual(1);
    const second = await sweepRetention(handle.db, later);
    expect(second.deletedOffers).toBe(0);
    expect(second.failures).toEqual([]);
  });

  it('records audit rows with counts only', async () => {
    const audits = await handle.db.select().from(retentionEvents);
    for (const event of audits) {
      expect(event.deletedCount).toBeGreaterThan(0);
      expect(event.searchId === null || /^[A-Za-z0-9_-]{43}$/.test(event.searchId)).toBe(true);
    }
  });
});

describe('cleanup coverage for orchestration scenarios', () => {
  it('cancellation/expiry path: material of an action-paused search still falls to the ceiling', async () => {
    const created = await createSearchSession(handle.db, {
      resolved: { ...canaryResolved(), validationState: 'validated_unit_missing' },
      policy: { ...policy, rawAddressTtlMinutes: 1 },
      now: NOW,
    });
    const row = await getSearch(handle.db, created.searchId);
    expect(row?.state).toBe('address_action_required');
    const later = new Date(NOW.getTime() + 2 * 60_000);
    await sweepRetention(handle.db, later);
    const material = await handle.pool.query(
      'select 1 from search_address_material where search_id = $1',
      [created.searchId],
    );
    expect(material.rowCount).toBe(0);
  });

  it('searches whose material was swept still keep their non-PII audit facts', async () => {
    const dump = await handle.pool.query('select count(*)::int as searches from searches');
    expect((dump.rows[0] as { searches: number }).searches).toBeGreaterThan(0);
  });
});
