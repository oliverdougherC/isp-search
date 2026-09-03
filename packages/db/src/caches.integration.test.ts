import { randomBytes } from 'node:crypto';

import { createRegistryCandidateDiscovery, loadBundledRegistry } from '@isp-search/discovery';
import {
  knownMoney,
  knownSpeed,
  unknownMoney,
  type AddressOffer,
  type CatalogPlan,
  type Provenance,
} from '@isp-search/domain';
import { createLogger } from '@isp-search/observability';
import { createSyntheticResolver } from '@isp-search/resolver';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { readCatalogPlans, upsertCatalogPlan } from './caches.js';
import { createDatabase, type DatabaseHandle } from './client.js';
import { runMigrations } from './migrations.js';
import {
  claimQualificationJob,
  settleQualificationJob,
  startQualification,
  type OrchestrationDeps,
} from './orchestration.js';
import { createJobQueue, type JobQueue } from './queue/index.js';
import { buildSearchResource } from './read-model.js';
import { importRegistry } from './registry.js';
import { seedReferenceProviders } from './seed.js';
import { createSearchSession, type SessionPolicy } from './sessions.js';

/**
 * Layered-cache proofs (PLA-369): catalog observations vs address qualification, identity-
 * keyed reuse, expiry, adapter/parser version coexistence, HMAC rotation, and preserved
 * disagreements.
 */
const base = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL'];
if (!base) {
  throw new Error('db integration tests need DATABASE_URL_TEST or DATABASE_URL');
}
const adminUrl = new URL(base);
const testDbName = `isp_search_cache_${String(process.pid)}`;
let handle: DatabaseHandle;
let queue: JobQueue;

const NOW = new Date('2026-09-03T12:00:00.000Z');
const resolver = createSyntheticResolver();

const policy: SessionPolicy = {
  hmacKey: { version: 1, secret: randomBytes(32).toString('hex') },
  rawAddressKey: { version: 1, secretHex: randomBytes(32).toString('hex') },
  rawAddressTtlMinutes: 30,
  searchTtlMinutes: 60,
  deadlineSeconds: 60,
  consentVersion: 'test-1',
};

function orchestrationDeps(overrides: Partial<OrchestrationDeps> = {}): OrchestrationDeps {
  return {
    queue,
    discovery: createRegistryCandidateDiscovery({
      loadRegistry: () => Promise.resolve(loadBundledRegistry('synthetic-dev')),
    }),
    // Only reference-available runs an adapter here; everything else stays link-only.
    adapterVersionFor: (providerId) => (providerId === 'reference-available' ? '1.0.0' : null),
    isProviderEnabled: () => true,
    policy,
    now: () => NOW,
    ...overrides,
  };
}

function provenance(): Provenance {
  return {
    schemaVersion: 1,
    sourceType: 'synthetic',
    sourceDomain: 'example.com',
    sourceUrl: 'https://example.com/reference',
    retrievedAt: NOW.toISOString(),
    dataVintage: null,
    lastReviewed: '2026-09-01',
    geographicPrecision: 'address',
    adapterVersion: '1.0.0',
    parserVersion: '1.0.0',
    contentHash: null,
    limitations: [],
  };
}

function offer(offerKey: string): AddressOffer {
  return {
    kind: 'address_offer',
    schemaVersion: 1,
    providerId: 'reference-available',
    offerKey,
    planKey: 'fiber-1gig',
    name: 'Fiber 1 Gig',
    technology: 'fiber',
    download: knownSpeed(1000),
    upload: knownSpeed(1000),
    dataAllowance: { kind: 'unlimited' },
    contract: { kind: 'none' },
    priceComponents: [
      {
        type: 'base_recurring',
        label: 'Base rate',
        amount: knownMoney(6500),
        cadence: 'monthly',
        appliesFromMonth: null,
        appliesThroughMonth: null,
        requiredConditions: [],
        included: true,
      },
    ],
    postPromotionMonthly: unknownMoney('not_disclosed'),
    conditions: [],
    orderUrl: null,
    broadbandFactsUrl: null,
    provenance: provenance(),
  };
}

async function startSearch(line1: string, unit: string | null = null, p = policy): Promise<string> {
  const resolved = await resolver.resolve(
    { line1, unit, city: 'Fixtureville', region: 'ZZ', postalCode: '00000' },
    { now: () => NOW },
  );
  const created = await createSearchSession(handle.db, { resolved, policy: p, now: NOW });
  return created.searchId;
}

async function qualifyAvailable(searchId: string, offers: AddressOffer[]): Promise<void> {
  const data = {
    searchId,
    providerId: 'reference-available',
    adapterVersion: '1.0.0',
    correlationId: 'cache-test',
    deadlineAt: new Date(NOW.getTime() + 60_000).toISOString(),
  };
  const claim = await claimQualificationJob(handle, data, NOW);
  if (claim.action !== 'run') throw new Error(`claim failed: ${JSON.stringify(claim)}`);
  await settleQualificationJob(
    handle,
    {
      jobId: claim.jobId,
      data,
      attempt: claim.attempt,
      result: {
        outcome: 'available',
        evidence: {
          sourceType: 'synthetic',
          capturedAt: NOW.toISOString(),
          adapterVersion: '1.0.0',
          parserVersion: '1.0.0',
          fingerprint: `sha256:${'a'.repeat(64)}`,
        },
        offers,
        diagnostics: { code: 'test' },
      },
      startedAt: NOW,
      finishedAt: new Date(NOW.getTime() + 1000),
    },
    orchestrationDeps(),
  );
}

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`create database ${testDbName}`);
  await admin.end();
  const url = new URL(base);
  url.pathname = `/${testDbName}`;
  handle = createDatabase({ connectionString: url.toString(), applicationName: 'cache-test' });
  await runMigrations(handle);
  await seedReferenceProviders(handle);
  await importRegistry(handle, loadBundledRegistry('synthetic-dev'), { activate: true });
  queue = createJobQueue({
    connectionString: url.toString(),
    schema: `pgboss_cache_${String(process.pid)}`,
    logger: createLogger({ name: 'cache-test', level: 'silent' }),
  });
  await queue.start();
});

afterAll(async () => {
  await queue.stop({ graceful: false, timeoutMs: 2_000 });
  await handle.close();
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`drop database if exists ${testDbName} with (force)`);
  await admin.end();
});

describe('exact-address qualification cache', () => {
  it('reuses a fresh observation for the same identity with the ORIGINAL observation time', async () => {
    const first = await startSearch('900 Synthetic Cache Ln');
    await startQualification(handle, first, orchestrationDeps());
    await qualifyAvailable(first, [offer('fiber-1gig-promo')]);

    const second = await startSearch('900 Synthetic Cache Ln');
    const result = await startQualification(handle, second, orchestrationDeps());
    if (result.status !== 'started') throw new Error(`unexpected ${result.status}`);
    expect(result.jobs).toBe(0); // no queue job: the cache settled it
    const job = await handle.pool.query(
      "select state, outcome, last_diagnostic_code from qualification_jobs where search_id = $1 and provider_id = 'reference-available'",
      [second],
    );
    expect(job.rows[0]).toEqual({
      state: 'succeeded',
      outcome: 'available',
      last_diagnostic_code: 'qualification_cache_reuse',
    });
    const offers = await handle.pool.query(
      'select retrieved_at from address_offers where search_id = $1',
      [second],
    );
    expect(offers.rowCount).toBe(1);
    // Observation time preserved from the first search, not re-stamped.
    expect((offers.rows[0] as { retrieved_at: Date }).retrieved_at.toISOString()).toBe(
      new Date(NOW.getTime() + 1000).toISOString(),
    );
  });

  it('a different unit is a different identity: no reuse', async () => {
    const first = await startSearch('901 Synthetic Cache Ln');
    await startQualification(handle, first, orchestrationDeps());
    await qualifyAvailable(first, [offer('fiber-1gig-promo')]);
    const withUnit = await startSearch('901 Synthetic Cache Ln', 'Unit 2');
    const result = await startQualification(handle, withUnit, orchestrationDeps());
    if (result.status !== 'started') throw new Error(`unexpected ${result.status}`);
    expect(result.jobs).toBe(1);
  });

  it('expired observations never reuse', async () => {
    const first = await startSearch('902 Synthetic Cache Ln');
    await startQualification(handle, first, orchestrationDeps());
    await qualifyAvailable(first, [offer('fiber-1gig-promo')]);
    await handle.pool.query(
      "update address_offers set expires_at = now() - interval '1 hour' where search_id = $1",
      [first],
    );
    const second = await startSearch('902 Synthetic Cache Ln');
    const result = await startQualification(handle, second, orchestrationDeps());
    if (result.status !== 'started') throw new Error(`unexpected ${result.status}`);
    expect(result.jobs).toBe(1);
  });

  it("a new adapter version never reads the old version's cache", async () => {
    const first = await startSearch('903 Synthetic Cache Ln');
    await startQualification(handle, first, orchestrationDeps());
    await qualifyAvailable(first, [offer('fiber-1gig-promo')]);
    const second = await startSearch('903 Synthetic Cache Ln');
    const result = await startQualification(
      handle,
      second,
      orchestrationDeps({
        adapterVersionFor: (providerId) => (providerId === 'reference-available' ? '2.0.0' : null),
      }),
    );
    if (result.status !== 'started') throw new Error(`unexpected ${result.status}`);
    expect(result.jobs).toBe(1);
  });

  it('an HMAC key rotation changes every identity: no cross-version reuse', async () => {
    const first = await startSearch('904 Synthetic Cache Ln');
    await startQualification(handle, first, orchestrationDeps());
    await qualifyAvailable(first, [offer('fiber-1gig-promo')]);
    const rotated: SessionPolicy = {
      ...policy,
      hmacKey: { version: 2, secret: randomBytes(32).toString('hex') },
    };
    const second = await startSearch('904 Synthetic Cache Ln', null, rotated);
    const result = await startQualification(handle, second, orchestrationDeps({ policy: rotated }));
    if (result.status !== 'started') throw new Error(`unexpected ${result.status}`);
    expect(result.jobs).toBe(1);
  });
});

describe('catalog cache', () => {
  function plan(parserVersion: string, name: string): CatalogPlan {
    return {
      kind: 'catalog_plan',
      schemaVersion: 1,
      providerId: 'reference-available',
      planKey: 'fiber-1gig',
      name,
      technology: 'fiber',
      download: knownSpeed(1000),
      upload: knownSpeed(1000),
      typicalLatencyMs: 12,
      dataAllowance: { kind: 'unlimited' },
      broadbandFactsUrl: null,
      provenance: { ...provenance(), parserVersion },
    };
  }

  it('parser versions coexist; re-observation updates in place; expiry hides rows', async () => {
    const catalogPolicy = { ttlHours: 48 };
    await upsertCatalogPlan(handle.db, {
      plan: plan('1.0.0', 'Fiber 1 Gig'),
      observedAt: NOW,
      policy: catalogPolicy,
    });
    await upsertCatalogPlan(handle.db, {
      plan: plan('2.0.0', 'Fiber One Gigabit'),
      observedAt: NOW,
      policy: catalogPolicy,
    });
    let cached = await readCatalogPlans(handle, 'reference-available', NOW);
    expect(cached).toHaveLength(2);
    expect(new Set(cached.map((entry) => entry.parserVersion))).toEqual(
      new Set(['1.0.0', '2.0.0']),
    );
    // Same key + parser version: updated, not duplicated.
    await upsertCatalogPlan(handle.db, {
      plan: plan('2.0.0', 'Fiber One Gigabit (renamed)'),
      observedAt: new Date(NOW.getTime() + 1000),
      policy: catalogPolicy,
    });
    cached = await readCatalogPlans(handle, 'reference-available', NOW);
    expect(cached).toHaveLength(2);
    expect(cached.find((entry) => entry.parserVersion === '2.0.0')?.plan.name).toBe(
      'Fiber One Gigabit (renamed)',
    );
    // Stale display state without hard expiry.
    const dayLater = new Date(NOW.getTime() + 30 * 3600 * 1000);
    cached = await readCatalogPlans(handle, 'reference-available', dayLater);
    expect(cached.every((entry) => entry.freshness === 'stale')).toBe(true);
    // Past the TTL the rows are gone from reads (and swept later by retention).
    const threeDays = new Date(NOW.getTime() + 72 * 3600 * 1000);
    expect(await readCatalogPlans(handle, 'reference-available', threeDays)).toHaveLength(0);
  });
});

describe('preserved disagreements', () => {
  it('an explicit unavailable coexists with likely candidate evidence, both visible', async () => {
    const searchId = await startSearch('905 Synthetic Cache Ln');
    await startQualification(handle, searchId, orchestrationDeps());
    const data = {
      searchId,
      providerId: 'reference-available',
      adapterVersion: '1.0.0',
      correlationId: 'conflict-test',
      deadlineAt: new Date(NOW.getTime() + 60_000).toISOString(),
    };
    const claim = await claimQualificationJob(handle, data, NOW);
    if (claim.action !== 'run') throw new Error('claim failed');
    await settleQualificationJob(
      handle,
      {
        jobId: claim.jobId,
        data,
        attempt: claim.attempt,
        result: {
          outcome: 'unavailable',
          evidence: {
            sourceType: 'synthetic',
            capturedAt: NOW.toISOString(),
            adapterVersion: '1.0.0',
            parserVersion: '1.0.0',
            fingerprint: `sha256:${'b'.repeat(64)}`,
          },
          diagnostics: { code: 'test' },
        },
        startedAt: NOW,
        finishedAt: new Date(NOW.getTime() + 500),
      },
      orchestrationDeps(),
    );
    const read = await buildSearchResource(handle, searchId, new Date(NOW.getTime() + 2_000));
    if (read.kind !== 'ok') throw new Error(read.kind);
    const provider = read.resource.providers.find(
      (entry) => entry.providerId === 'reference-available',
    );
    // The stronger explicit answer controls the state...
    expect(provider?.availability).toBe('verified_unavailable');
    expect(provider?.availabilityBasis).toBe('provider_qualification');
    // ...but the disagreeing candidate evidence is retained and shown, not overwritten.
    expect(provider?.evidence.length).toBeGreaterThan(0);
    expect(provider?.evidence[0]?.evidenceClass).toBe('area_level_reported');
  });
});
