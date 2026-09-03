import { randomBytes } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabase, type DatabaseHandle } from './client.js';
import { runMigrations } from './migrations.js';
import {
  addressOffers,
  launchMarkets,
  offerPriceComponents,
  providerAliases,
  qualificationJobs,
  searchCandidates,
  searches,
} from './schema/index.js';
import { seedReferenceProviders } from './seed.js';

/**
 * Constraint proofs for the M2 schema (PLA-361): idempotency uniques, semantic checks, and
 * deliberate deletion behavior, against a throwaway database migrated from empty.
 */
const base = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL'];
if (!base) {
  throw new Error('db integration tests need DATABASE_URL_TEST or DATABASE_URL');
}
const adminUrl = new URL(base);
const testDbName = `isp_search_schema_${String(process.pid)}`;
let handle: DatabaseHandle;

function opaqueSearchId(): string {
  return randomBytes(32).toString('base64url');
}

const FUTURE = new Date('2027-01-01T00:00:00.000Z');

/** Drizzle wraps pg errors; the constraint name lives on `cause`. */
async function expectDbRejection(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause;
    const text = `${String(error)} ${cause instanceof Error ? cause.message : ''}`;
    expect(text).toMatch(pattern);
    return;
  }
  expect.fail(`expected rejection matching ${String(pattern)}`);
}

async function insertSearch(id: string): Promise<void> {
  await handle.db.insert(searches).values({
    id,
    consentVersion: 'test-1',
    deadlineAt: FUTURE,
    expiresAt: FUTURE,
  });
}

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

describe('searches table', () => {
  it('rejects a low-entropy search id', async () => {
    await expectDbRejection(
      handle.db.insert(searches).values({
        id: 'search-1',
        consentVersion: 'test-1',
        deadlineAt: FUTURE,
        expiresAt: FUTURE,
      }),
      /searches_id_shape/,
    );
  });

  it('rejects an address identity without its key version', async () => {
    await expectDbRejection(
      handle.db.insert(searches).values({
        id: opaqueSearchId(),
        consentVersion: 'test-1',
        deadlineAt: FUTURE,
        expiresAt: FUTURE,
        addressIdentity: 'v1:deadbeef',
      }),
      /searches_identity_version_together/,
    );
  });
});

describe('qualification job and offer idempotency', () => {
  it('one job per (search, provider, adapter version); duplicate insert fails', async () => {
    const searchId = opaqueSearchId();
    await insertSearch(searchId);
    const job = { searchId, providerId: 'reference-available', adapterVersion: '1.0.0' };
    await handle.db.insert(qualificationJobs).values(job);
    await expectDbRejection(
      handle.db.insert(qualificationJobs).values(job),
      /qualification_jobs_idempotency/,
    );
  });

  it('duplicate delivery cannot create duplicate canonical offers', async () => {
    const searchId = opaqueSearchId();
    await insertSearch(searchId);
    const [job] = await handle.db
      .insert(qualificationJobs)
      .values({ searchId, providerId: 'reference-available', adapterVersion: '1.0.0' })
      .returning();
    if (!job) throw new Error('job insert returned nothing');
    const offer = {
      searchId,
      providerId: 'reference-available',
      jobId: job.id,
      adapterVersion: '1.0.0',
      offerKey: 'fiber-1gig',
      offer: { kind: 'address_offer' },
      addressIdentity: 'v1:00',
      addressIdentityVersion: 1,
      retrievedAt: FUTURE,
      expiresAt: FUTURE,
    };
    await handle.db.insert(addressOffers).values(offer);
    await expectDbRejection(
      handle.db.insert(addressOffers).values(offer),
      /address_offers_idempotency/,
    );
  });

  it('a catalog plan payload cannot be stored as an address offer', async () => {
    const searchId = opaqueSearchId();
    await insertSearch(searchId);
    const [job] = await handle.db
      .insert(qualificationJobs)
      .values({ searchId, providerId: 'reference-unavailable', adapterVersion: '1.0.0' })
      .returning();
    if (!job) throw new Error('job insert returned nothing');
    await expectDbRejection(
      handle.db.insert(addressOffers).values({
        searchId,
        providerId: 'reference-unavailable',
        jobId: job.id,
        adapterVersion: '1.0.0',
        offerKey: 'x',
        offer: { kind: 'catalog_plan' },
        addressIdentity: 'v1:00',
        addressIdentityVersion: 1,
        retrievedAt: FUTURE,
        expiresAt: FUTURE,
      }),
      /address_offers_kind/,
    );
  });
});

describe('price component money shape', () => {
  it('unknown amounts cannot carry cents and known amounts must', async () => {
    const searchId = opaqueSearchId();
    await insertSearch(searchId);
    const [job] = await handle.db
      .insert(qualificationJobs)
      .values({ searchId, providerId: 'reference-available', adapterVersion: '2.0.0' })
      .returning();
    if (!job) throw new Error('job insert returned nothing');
    const [offer] = await handle.db
      .insert(addressOffers)
      .values({
        searchId,
        providerId: 'reference-available',
        jobId: job.id,
        adapterVersion: '2.0.0',
        offerKey: 'fiber-500',
        offer: { kind: 'address_offer' },
        addressIdentity: 'v1:00',
        addressIdentityVersion: 1,
        retrievedAt: FUTURE,
        expiresAt: FUTURE,
      })
      .returning();
    if (!offer) throw new Error('offer insert returned nothing');
    await expectDbRejection(
      handle.db.insert(offerPriceComponents).values({
        offerId: offer.id,
        position: 0,
        componentType: 'base_recurring',
        label: 'Base',
        amountKind: 'unknown',
        amountCents: 6500,
        unknownReason: 'not_disclosed',
        cadence: 'monthly',
        included: true,
      }),
      /offer_price_components_money_shape/,
    );
    await expectDbRejection(
      handle.db.insert(offerPriceComponents).values({
        offerId: offer.id,
        position: 0,
        componentType: 'base_recurring',
        label: 'Base',
        amountKind: 'known',
        amountCents: null,
        unknownReason: null,
        cadence: 'monthly',
        included: true,
      }),
      /offer_price_components_money_shape/,
    );
    await handle.db.insert(offerPriceComponents).values({
      offerId: offer.id,
      position: 0,
      componentType: 'base_recurring',
      label: 'Base',
      amountKind: 'known',
      amountCents: 6500,
      unknownReason: null,
      cadence: 'monthly',
      included: true,
    });
  });
});

describe('candidate evidence and alias constraints', () => {
  it('candidate evidence can never claim the provider_qualification class', async () => {
    const searchId = opaqueSearchId();
    await insertSearch(searchId);
    await expectDbRejection(
      handle.db.insert(searchCandidates).values({
        searchId,
        providerId: 'reference-available',
        evidenceClass: 'provider_qualification',
        evidence: {},
      }),
      /search_candidates_not_qualification/,
    );
  });

  it('one normalized alias cannot map to two providers in the same source', async () => {
    await handle.db.insert(providerAliases).values({
      providerId: 'reference-available',
      kind: 'alias',
      sourceType: 'launch_registry',
      value: 'Reference Co',
      valueNormalized: 'reference co',
    });
    await expectDbRejection(
      handle.db.insert(providerAliases).values({
        providerId: 'reference-unavailable',
        kind: 'alias',
        sourceType: 'launch_registry',
        value: 'REFERENCE CO',
        valueNormalized: 'reference co',
      }),
      /provider_aliases_unique_per_source/,
    );
  });
});

describe('deliberate deletion behavior', () => {
  it('deleting a search cascades to jobs and offers but leaves providers intact', async () => {
    const searchId = opaqueSearchId();
    await insertSearch(searchId);
    const [job] = await handle.db
      .insert(qualificationJobs)
      .values({ searchId, providerId: 'reference-timeout', adapterVersion: '1.0.0' })
      .returning();
    if (!job) throw new Error('job insert returned nothing');
    await handle.db.insert(addressOffers).values({
      searchId,
      providerId: 'reference-timeout',
      jobId: job.id,
      adapterVersion: '1.0.0',
      offerKey: 'k',
      offer: { kind: 'address_offer' },
      addressIdentity: 'v1:00',
      addressIdentityVersion: 1,
      retrievedAt: FUTURE,
      expiresAt: FUTURE,
    });
    const del = await handle.pool.query('delete from searches where id = $1', [searchId]);
    expect(del.rowCount).toBe(1);
    const jobs = await handle.pool.query(
      'select count(*)::int as n from qualification_jobs where search_id = $1',
      [searchId],
    );
    expect(jobs.rows[0]).toEqual({ n: 0 });
    const providers = await handle.pool.query(
      "select count(*)::int as n from provider_brands where id = 'reference-timeout'",
    );
    expect(providers.rows[0]).toEqual({ n: 1 });
  });

  it('a provider with recorded offers cannot be deleted out from under them', async () => {
    const searchId = opaqueSearchId();
    await insertSearch(searchId);
    await handle.db
      .insert(qualificationJobs)
      .values({ searchId, providerId: 'reference-unit-required', adapterVersion: '1.0.0' });
    await expectDbRejection(
      handle.pool.query("delete from provider_brands where id = 'reference-unit-required'"),
      /foreign key constraint "qualification_jobs_provider_id_provider_brands_id_fk"/,
    );
  });

  it('market deletion detaches searches without destroying them', async () => {
    await handle.db.insert(launchMarkets).values({
      id: 'synthetic-test',
      name: 'Synthetic Test Market',
      kind: 'synthetic',
      geoids: ['synthetic-test'],
      status: 'development_only',
      registryVersion: 'dev-0',
      lastReviewed: '2026-09-03',
    });
    const searchId = opaqueSearchId();
    await handle.db.insert(searches).values({
      id: searchId,
      consentVersion: 'test-1',
      deadlineAt: FUTURE,
      expiresAt: FUTURE,
      marketId: 'synthetic-test',
    });
    await handle.pool.query("delete from launch_markets where id = 'synthetic-test'");
    const row = await handle.pool.query('select market_id from searches where id = $1', [searchId]);
    expect(row.rows[0]).toEqual({ market_id: null });
  });
});
