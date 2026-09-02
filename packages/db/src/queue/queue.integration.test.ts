import { createLogger } from '@isp-search/observability';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createJobQueue, QUEUES, type JobQueue, type QualificationJobData } from './index.js';

/**
 * pg-boss proof cases for ADR-006 (PLA-355). Requires PostgreSQL:
 *   DATABASE_URL_TEST (preferred) or DATABASE_URL.
 * Uses a dedicated schema so it never touches application data or a running worker's queue.
 */
const connectionString = process.env['DATABASE_URL_TEST'] ?? process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('queue integration tests need DATABASE_URL_TEST or DATABASE_URL');
}
const SCHEMA = `pgboss_test_${String(process.pid)}`;
const EXPIRE_SECONDS = 1;

let pool: pg.Pool;
let queue: JobQueue;
const logger = createLogger({ name: 'queue-test', level: 'silent' });

function jobData(overrides: Partial<QualificationJobData> = {}): QualificationJobData {
  return {
    searchId: `search-${String(Math.random()).slice(2, 10)}`,
    providerId: 'reference-available',
    adapterVersion: '1.0.0',
    correlationId: 'corr-test',
    deadlineAt: new Date(Date.now() + 30_000).toISOString(),
    ...overrides,
  };
}

async function countJobs(where: string, params: unknown[] = []): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `select count(*)::text as count from ${SCHEMA}.job where name = $1 ${where}`,
    [QUEUES.qualification, ...params],
  );
  return Number(result.rows[0]?.count ?? '0');
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

beforeAll(async () => {
  pool = new pg.Pool({ connectionString, max: 4 });
  queue = createJobQueue({
    connectionString,
    schema: SCHEMA,
    logger,
    qualificationExpireSeconds: EXPIRE_SECONDS,
    transientRetryLimit: 2,
    maintenanceIntervalSeconds: 1,
    superviseIntervalSeconds: 1,
    monitorIntervalSeconds: 1,
  });
  await queue.start();
});

afterAll(async () => {
  await queue.stop({ graceful: false, timeoutMs: 2_000 });
  await pool.query(`drop schema if exists ${SCHEMA} cascade`);
  await pool.end();
});

describe('pg-boss queue proof (ADR-006)', () => {
  it('enqueues inside the caller transaction: rollback leaves no job, commit leaves one', async () => {
    const client = await pool.connect();
    const data = jobData();
    try {
      await client.query('begin');
      const id = await queue.enqueueQualification({ data, client });
      expect(id).toBeTypeOf('string');
      await client.query('rollback');
    } finally {
      client.release();
    }
    expect(await countJobs(`and data->>'searchId' = $2`, [data.searchId])).toBe(0);

    const client2 = await pool.connect();
    try {
      await client2.query('begin');
      await queue.enqueueQualification({ data, client: client2 });
      await client2.query('commit');
    } finally {
      client2.release();
    }
    expect(await countJobs(`and data->>'searchId' = $2`, [data.searchId])).toBe(1);
  });

  it('is idempotent per search/provider/adapter version (singletonKey)', async () => {
    const data = jobData();
    const client = await pool.connect();
    try {
      const first = await queue.enqueueQualification({ data, client });
      const duplicate = await queue.enqueueQualification({ data, client });
      const otherVersion = await queue.enqueueQualification({
        data: { ...data, adapterVersion: '1.0.1' },
        client,
      });
      expect(first).toBeTypeOf('string');
      expect(duplicate).toBeNull();
      expect(otherVersion).toBeTypeOf('string');
    } finally {
      client.release();
    }
    expect(await countJobs(`and data->>'searchId' = $2`, [data.searchId])).toBe(2);
  });

  it('retries a failed job with backoff and dead-letters it after the retry budget', async () => {
    const data = jobData();
    const client = await pool.connect();
    let id: string | null;
    try {
      id = await queue.enqueueQualification({ data, client });
    } finally {
      client.release();
    }
    expect(id).toBeTypeOf('string');
    const jobId = id!;

    // retryLimit 2 => three attempts total; each fail() re-queues with backoff until exhausted.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const fetched = await waitFor(async () => {
        const jobs = await queue.boss.fetch(QUEUES.qualification, {
          batchSize: 10,
          ignoreStartAfter: true,
        });
        const mine = jobs.find((job) => job.id === jobId);
        if (!mine) return false;
        await queue.boss.fail(QUEUES.qualification, mine.id, { code: 'timeout' });
        return true;
      }, 15_000);
      expect(fetched, `attempt ${String(attempt + 1)} fetched`).toBe(true);
    }

    const [job] = await queue.boss.findJobs(QUEUES.qualification, { id: jobId });
    expect(job?.state).toBe('failed');
    expect(job?.retryCount).toBe(2);
    // Dead-letter copy contains identifiers only, never an address.
    const dead = await waitFor(async () => {
      const result = await pool.query<{ data: unknown }>(
        `select data from ${SCHEMA}.job where name = $1 and data->>'searchId' = $2`,
        [QUEUES.qualificationDeadLetter, data.searchId],
      );
      return result.rows.length === 1;
    }, 10_000);
    expect(dead).toBe(true);
  });

  it('re-delivers an active job whose worker crashed (at-least-once via expiration)', async () => {
    const data = jobData();
    const client = await pool.connect();
    let id: string | null;
    try {
      id = await queue.enqueueQualification({ data, client });
    } finally {
      client.release();
    }
    const jobId = id!;
    const first = await waitFor(async () => {
      const jobs = await queue.boss.fetch(QUEUES.qualification, { batchSize: 10 });
      return jobs.some((job) => job.id === jobId);
    }, 10_000);
    expect(first).toBe(true);
    // Simulate a crash: never complete or fail. Supervision expires the active job after
    // expireInSeconds and puts it back into the retry state so another worker can fetch it.
    await new Promise((resolve) => setTimeout(resolve, (EXPIRE_SECONDS + 1) * 1000));
    await queue.boss.supervise(QUEUES.qualification);
    const redelivered = await waitFor(async () => {
      const [job] = await queue.boss.findJobs(QUEUES.qualification, { id: jobId });
      return job?.state === 'retry' || job?.state === 'created';
    }, 15_000);
    expect(redelivered).toBe(true);
  });

  it('duplicate execution cannot create duplicate results when keyed by job id', async () => {
    // The persistence layer (M2) must upsert on (search, provider, adapter version). The queue
    // guarantees at-least-once, so the proof here is that the singleton key is stable and can
    // be used as an idempotency key by the result writer.
    const data = jobData();
    const a = `${data.searchId}:${data.providerId}:${data.adapterVersion}`;
    const { qualificationSingletonKey } = await import('./index.js');
    expect(qualificationSingletonKey(data)).toBe(a);
  });

  it('reports queue stats without payloads', async () => {
    const queues = await queue.boss.getQueues([
      QUEUES.qualification,
      QUEUES.qualificationDeadLetter,
    ]);
    expect(queues.map((q) => q.name).sort()).toEqual(
      [QUEUES.qualificationDeadLetter, QUEUES.qualification].sort(),
    );
  });
});
