import { randomBytes } from 'node:crypto';

import {
  createDatabase,
  createSearchSession,
  enforceSearchDeadlines,
  importRegistry,
  loadActiveRegistry,
  runMigrations,
  seedReferenceProviders,
  startQualification,
  submitProviderAction,
  type DatabaseHandle,
  type OrchestrationDeps,
  type SessionPolicy,
} from '@isp-search/db';
import { createJobQueue, type JobQueue, type QualificationJobData } from '@isp-search/db/queue';
import { createRegistryCandidateDiscovery, loadBundledRegistry } from '@isp-search/discovery';
import { createLogger } from '@isp-search/observability';
import { createAdapterRegistry, referenceAdapterSet } from '@isp-search/providers';
import { createSyntheticResolver } from '@isp-search/resolver';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createQualificationProcessor } from './processor.js';

/**
 * End-to-end orchestration proofs (PLA-367) against PostgreSQL: transactional fan-out,
 * duplicate-delivery convergence, per-outcome retry policy, action resume, deadline
 * enforcement, failure isolation, and deterministic partial/complete aggregation.
 */
const base = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL'];
if (!base) {
  throw new Error('worker integration tests need DATABASE_URL_TEST or DATABASE_URL');
}
const adminUrl = new URL(base);
const testDbName = `isp_search_orch_${String(process.pid)}`;
const QUEUE_SCHEMA = `pgboss_orch_${String(process.pid)}`;

let handle: DatabaseHandle;
let queue: JobQueue;
let orchestration: OrchestrationDeps;
let processJob: (data: QualificationJobData) => Promise<void>;

const logger = createLogger({ name: 'orch-test', level: 'silent' });
const resolver = createSyntheticResolver();
const adapters = referenceAdapterSet();
const adapterVersionByProvider = new Map(adapters.map((a) => [a.providerId, a.version]));
const disabledProviders = new Set(['reference-blocked']);

const policy: SessionPolicy = {
  hmacKey: { version: 1, secret: randomBytes(32).toString('hex') },
  rawAddressKey: { version: 1, secretHex: randomBytes(32).toString('hex') },
  rawAddressTtlMinutes: 30,
  searchTtlMinutes: 60,
  deadlineSeconds: 60,
  consentVersion: 'test-1',
};

async function newSearch(
  line1: string,
  overrides: Partial<SessionPolicy> = {},
  unit: string | null = null,
): Promise<string> {
  const resolved = await resolver.resolve(
    { line1, unit, city: 'Fixtureville', region: 'ZZ', postalCode: '00000' },
    { now: () => new Date() },
  );
  const created = await createSearchSession(handle.db, {
    resolved,
    policy: { ...policy, ...overrides },
    now: new Date(),
  });
  return created.searchId;
}

function jobData(searchId: string, providerId: string, deadlineAt: Date): QualificationJobData {
  return {
    searchId,
    providerId,
    adapterVersion: adapterVersionByProvider.get(providerId) ?? '1.0.0',
    correlationId: `test:${providerId}`,
    deadlineAt: deadlineAt.toISOString(),
  };
}

async function searchRow(searchId: string) {
  const rows = await handle.pool.query('select * from searches where id = $1', [searchId]);
  return rows.rows[0] as Record<string, unknown> & { state: string; deadline_at: Date };
}

async function jobRow(searchId: string, providerId: string) {
  const rows = await handle.pool.query(
    'select * from qualification_jobs where search_id = $1 and provider_id = $2',
    [searchId, providerId],
  );
  return rows.rows[0] as
    | (Record<string, unknown> & {
        state: string;
        outcome: string | null;
        attempt_count: number;
        action_options: string[] | null;
      })
    | undefined;
}

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`create database ${testDbName}`);
  await admin.end();
  const url = new URL(base);
  url.pathname = `/${testDbName}`;
  handle = createDatabase({ connectionString: url.toString(), applicationName: 'orch-test' });
  await runMigrations(handle);
  await seedReferenceProviders(handle);
  await importRegistry(handle, loadBundledRegistry('synthetic-dev'), { activate: true });
  queue = createJobQueue({
    connectionString: url.toString(),
    schema: QUEUE_SCHEMA,
    logger,
    transientRetryLimit: 3,
  });
  await queue.start();
  orchestration = {
    queue,
    discovery: createRegistryCandidateDiscovery({ loadRegistry: () => loadActiveRegistry(handle) }),
    adapterVersionFor: (providerId) => adapterVersionByProvider.get(providerId) ?? null,
    isProviderEnabled: (providerId) => !disabledProviders.has(providerId),
    policy,
    now: () => new Date(),
  };
  processJob = createQualificationProcessor({
    handle,
    registry: createAdapterRegistry(adapters, {
      enabledProviderIds: new Set(
        adapters.map((a) => a.providerId).filter((id) => !disabledProviders.has(id)),
      ),
    }),
    orchestration,
    logger,
    providerConcurrency: 2,
  });
});

afterAll(async () => {
  await queue.stop({ graceful: false, timeoutMs: 2_000 });
  await handle.close();
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`drop database if exists ${testDbName} with (force)`);
  await admin.end();
});

describe('fan-out', () => {
  it('creates candidates and one idempotent job per enabled provider, transactionally', async () => {
    const searchId = await newSearch('101 Synthetic Way');
    const result = await startQualification(handle, searchId, orchestration);
    if (result.status !== 'started') throw new Error(`unexpected ${result.status}`);
    expect(result.candidates).toBe(12);
    // 11 adapters exist (link-only has none); one (reference-blocked) is disabled and settles
    // as degraded immediately, so 10 queue jobs are created.
    expect(result.jobs).toBe(10);
    expect(result.state).toBe('partial'); // the degraded job already settled
    const again = await startQualification(handle, searchId, orchestration);
    expect(again.status).toBe('already_started');
    const count = await handle.pool.query(
      'select count(*)::int as n from qualification_jobs where search_id = $1',
      [searchId],
    );
    expect(count.rows[0]).toEqual({ n: 11 });
    const disabled = await jobRow(searchId, 'reference-blocked');
    expect(disabled?.state).toBe('degraded');
  });

  it('routes an unsupported-market address to a truthful complete with no candidates', async () => {
    const searchId = await newSearch('5 Unsupported Synthetic Rd');
    const result = await startQualification(handle, searchId, orchestration);
    expect(result.status).toBe('unsupported_market');
    const row = await searchRow(searchId);
    expect(row.state).toBe('complete');
    expect(row['reason_code']).toBe('unsupported_market');
    const material = await handle.pool.query(
      'select 1 from search_address_material where search_id = $1',
      [searchId],
    );
    expect(material.rowCount).toBe(0);
  });

  it('a discovery outage fails the search with a typed reason, never fabricated candidates', async () => {
    const searchId = await newSearch('102 Synthetic Way');
    const broken: OrchestrationDeps = {
      ...orchestration,
      discovery: createRegistryCandidateDiscovery({
        loadRegistry: () => Promise.reject(new Error('outage')),
      }),
    };
    const result = await startQualification(handle, searchId, broken);
    expect(result.status).toBe('discovery_unavailable');
    const row = await searchRow(searchId);
    expect(row.state).toBe('failed');
    expect(row['reason_code']).toBe('discovery_unavailable');
  });

  it('opens circuits settle immediately as degraded with the official link preserved', async () => {
    await handle.pool.query(
      "insert into provider_health (provider_id, circuit_state, reason) values ('reference-malformed','open','manual_disable') on conflict (provider_id) do update set circuit_state='open'",
    );
    const searchId = await newSearch('103 Synthetic Way');
    await startQualification(handle, searchId, orchestration);
    const job = await jobRow(searchId, 'reference-malformed');
    expect(job?.state).toBe('degraded');
    expect(job?.['last_diagnostic_code']).toBe('circuit_open');
    await handle.pool.query(
      "update provider_health set circuit_state='closed' where provider_id='reference-malformed'",
    );
  });
});

describe('processing and truth', () => {
  it('processes available and unavailable to succeeded jobs; duplicates converge', async () => {
    const searchId = await newSearch('104 Synthetic Way');
    await startQualification(handle, searchId, orchestration);
    const row = await searchRow(searchId);
    const deadline = row.deadline_at;
    await processJob(jobData(searchId, 'reference-available', deadline));
    await processJob(jobData(searchId, 'reference-unavailable', deadline));
    const available = await jobRow(searchId, 'reference-available');
    const unavailable = await jobRow(searchId, 'reference-unavailable');
    expect(available?.state).toBe('succeeded');
    expect(available?.outcome).toBe('available');
    expect(unavailable?.state).toBe('succeeded');
    expect(unavailable?.outcome).toBe('unavailable');
    // Duplicate delivery is a no-op: attempts don't grow.
    await processJob(jobData(searchId, 'reference-available', deadline));
    const attempts = await handle.pool.query(
      'select count(*)::int as n from qualification_attempts a join qualification_jobs j on j.id = a.job_id where j.search_id = $1 and j.provider_id = $2',
      [searchId, 'reference-available'],
    );
    expect(attempts.rows[0]).toEqual({ n: 1 });
    const search = await searchRow(searchId);
    expect(search.state).toBe('partial');
  });

  it('retries transient outcomes within the budget and degrades afterwards', async () => {
    const searchId = await newSearch('105 Synthetic Way');
    await startQualification(handle, searchId, orchestration);
    const deadline = (await searchRow(searchId)).deadline_at;
    const data = jobData(searchId, 'reference-timeout', deadline);
    // Attempts 1..3 are transient retries; attempt 4 exhausts the budget.
    for (let i = 0; i < 4; i += 1) {
      await processJob(data);
    }
    const job = await jobRow(searchId, 'reference-timeout');
    expect(job?.state).toBe('degraded');
    expect(job?.outcome).toBe('timeout');
    expect(job?.attempt_count).toBe(4);
  });

  it('rate-limited succeeds on the retry attempt', async () => {
    const searchId = await newSearch('106 Synthetic Way');
    await startQualification(handle, searchId, orchestration);
    const deadline = (await searchRow(searchId)).deadline_at;
    const data = jobData(searchId, 'reference-rate-limited', deadline);
    await processJob(data); // attempt 1: rate_limited -> retry
    await processJob(data); // attempt 2: available
    const job = await jobRow(searchId, 'reference-rate-limited');
    expect(job?.state).toBe('succeeded');
    expect(job?.outcome).toBe('available');
  });

  it('maintenance failures (malformed) settle degraded without retry', async () => {
    const searchId = await newSearch('107 Synthetic Way');
    await startQualification(handle, searchId, orchestration);
    const deadline = (await searchRow(searchId)).deadline_at;
    await processJob(jobData(searchId, 'reference-malformed', deadline));
    const job = await jobRow(searchId, 'reference-malformed');
    expect(job?.state).toBe('degraded');
    expect(job?.outcome).toBe('parse_error');
    expect(job?.attempt_count).toBe(1);
  });

  it('a unit-required provider pauses alone; peers stay visible; resume completes it', async () => {
    const searchId = await newSearch('108 Synthetic Way');
    await startQualification(handle, searchId, orchestration);
    const deadline = (await searchRow(searchId)).deadline_at;
    await processJob(jobData(searchId, 'reference-available', deadline));
    await processJob(jobData(searchId, 'reference-unit-required', deadline));
    const paused = await jobRow(searchId, 'reference-unit-required');
    expect(paused?.state).toBe('action_required');
    expect(paused?.action_options?.length).toBeGreaterThan(0);
    // Completed peer results remain visible while this provider waits.
    const peer = await jobRow(searchId, 'reference-available');
    expect(peer?.state).toBe('succeeded');
    expect((await searchRow(searchId)).state).toBe('partial');
    const choice = paused?.action_options?.[0];
    if (!choice) throw new Error('no action options');
    await submitProviderAction(handle, queue, {
      searchId,
      providerId: 'reference-unit-required',
      choice,
      now: new Date(),
    });
    expect((await jobRow(searchId, 'reference-unit-required'))?.state).toBe('queued');
    await processJob(jobData(searchId, 'reference-unit-required', deadline));
    const resumed = await jobRow(searchId, 'reference-unit-required');
    expect(resumed?.state).toBe('succeeded');
    expect(resumed?.outcome).toBe('available');
    // The answer stayed with this provider only.
    const others = await handle.pool.query(
      'select count(*)::int as n from qualification_jobs where search_id = $1 and action_response is not null',
      [searchId],
    );
    expect(others.rows[0]).toEqual({ n: 1 });
  });

  it('a crashed worker redelivery continues the same job row', async () => {
    const searchId = await newSearch('109 Synthetic Way');
    await startQualification(handle, searchId, orchestration);
    const deadline = (await searchRow(searchId)).deadline_at;
    // Simulate a crash: claim marks running, then nothing settles.
    const { claimQualificationJob } = await import('@isp-search/db');
    const claim = await claimQualificationJob(
      handle,
      jobData(searchId, 'reference-conflicting', deadline),
      new Date(),
    );
    expect(claim.action).toBe('run');
    expect((await jobRow(searchId, 'reference-conflicting'))?.state).toBe('running');
    // Redelivery processes to completion on the same row.
    await processJob(jobData(searchId, 'reference-conflicting', deadline));
    const job = await jobRow(searchId, 'reference-conflicting');
    expect(job?.state).toBe('succeeded');
    expect(job?.outcome).toBe('unavailable');
    expect(job?.attempt_count).toBe(2);
  });
});

describe('deadline and late results', () => {
  it('discards a result that finishes after the global deadline', async () => {
    const searchId = await newSearch('110 Synthetic Way', { deadlineSeconds: 3 });
    await startQualification(handle, searchId, orchestration);
    const deadline = (await searchRow(searchId)).deadline_at;
    // The late adapter deliberately returns ~2s after the deadline.
    await processJob(jobData(searchId, 'reference-late', deadline));
    const job = await jobRow(searchId, 'reference-late');
    expect(job?.state).toBe('expired');
    expect(job?.['last_diagnostic_code']).toBe('late_result_discarded');
    const offers = await handle.pool.query(
      'select count(*)::int as n from address_offers where search_id = $1',
      [searchId],
    );
    expect(offers.rows[0]).toEqual({ n: 0 });
  });

  it('the deadline sweep expires unsettled jobs and completes the search truthfully', async () => {
    const searchId = await newSearch('111 Synthetic Way', { deadlineSeconds: 2 });
    await startQualification(handle, searchId, orchestration);
    const deadline = (await searchRow(searchId)).deadline_at;
    // One provider finished before the deadline.
    await processJob(jobData(searchId, 'reference-available', deadline));
    await new Promise((resolve) => setTimeout(resolve, deadline.getTime() - Date.now() + 200));
    const summary = await enforceSearchDeadlines(handle, new Date());
    expect(summary.expiredJobs).toBeGreaterThan(0);
    const search = await searchRow(searchId);
    expect(search.state).toBe('complete');
    // The finished provider's result survives; unfinished ones expired.
    expect((await jobRow(searchId, 'reference-available'))?.state).toBe('succeeded');
    expect((await jobRow(searchId, 'reference-slow'))?.state).toBe('expired');
    // Raw address deleted once everything settled.
    const material = await handle.pool.query(
      'select 1 from search_address_material where search_id = $1',
      [searchId],
    );
    expect(material.rowCount).toBe(0);
  });

  it('claims past the deadline are discarded and expired without running the adapter', async () => {
    const searchId = await newSearch('112 Synthetic Way', { deadlineSeconds: 1 });
    await startQualification(handle, searchId, orchestration);
    const deadline = (await searchRow(searchId)).deadline_at;
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    await processJob(jobData(searchId, 'reference-available', deadline));
    const job = await jobRow(searchId, 'reference-available');
    expect(job?.state).toBe('expired');
    expect(job?.attempt_count).toBe(0);
  });
});

describe('failure isolation and completion semantics', () => {
  it('one provider failing never hides other results; mixed searches complete', async () => {
    const searchId = await newSearch('113 Synthetic Way', { deadlineSeconds: 8 });
    await startQualification(handle, searchId, orchestration);
    const deadline = (await searchRow(searchId)).deadline_at;
    // Fast providers first (all instant under the fake-free clock)...
    for (const providerId of [
      'reference-available',
      'reference-unavailable',
      'reference-malformed',
      'reference-conflicting',
      'reference-rate-limited',
    ]) {
      await processJob(jobData(searchId, providerId, deadline));
    }
    await processJob(jobData(searchId, 'reference-rate-limited', deadline)); // retry -> available
    for (let i = 0; i < 4; i += 1) {
      await processJob(jobData(searchId, 'reference-timeout', deadline));
    }
    await processJob(jobData(searchId, 'reference-ambiguous', deadline));
    const ambiguous = await jobRow(searchId, 'reference-ambiguous');
    expect(ambiguous?.state).toBe('action_required');
    await submitProviderAction(handle, queue, {
      searchId,
      providerId: 'reference-ambiguous',
      choice: ambiguous?.action_options?.[0] ?? '',
      now: new Date(),
    });
    await processJob(jobData(searchId, 'reference-ambiguous', deadline));
    await processJob(jobData(searchId, 'reference-unit-required', deadline));
    const unitJob = await jobRow(searchId, 'reference-unit-required');
    await submitProviderAction(handle, queue, {
      searchId,
      providerId: 'reference-unit-required',
      choice: unitJob?.action_options?.[0] ?? '',
      now: new Date(),
    });
    await processJob(jobData(searchId, 'reference-unit-required', deadline));
    // ...then the slow provider (finishes inside the deadline) and the late provider
    // (deliberately finishes ~2s after it, and is discarded).
    await processJob(jobData(searchId, 'reference-slow', deadline));
    await processJob(jobData(searchId, 'reference-late', deadline));

    const states = await handle.pool.query(
      'select provider_id, state, outcome from qualification_jobs where search_id = $1 order by provider_id',
      [searchId],
    );
    const byProvider = new Map(
      (states.rows as { provider_id: string; state: string; outcome: string | null }[]).map(
        (row) => [row.provider_id, row],
      ),
    );
    expect(byProvider.get('reference-available')?.state).toBe('succeeded');
    expect(byProvider.get('reference-unavailable')?.outcome).toBe('unavailable');
    expect(byProvider.get('reference-malformed')?.state).toBe('degraded');
    expect(byProvider.get('reference-timeout')?.state).toBe('degraded');
    expect(byProvider.get('reference-blocked')?.state).toBe('degraded');
    expect(byProvider.get('reference-slow')?.state).toBe('succeeded');
    expect(byProvider.get('reference-late')?.state).toBe('expired');
    const search = await searchRow(searchId);
    // Every job settled -> complete, even though several providers failed or stayed unknown.
    expect(search.state).toBe('complete');
    const material = await handle.pool.query(
      'select 1 from search_address_material where search_id = $1',
      [searchId],
    );
    expect(material.rowCount).toBe(0);
  });
});
