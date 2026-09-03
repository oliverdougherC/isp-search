import { classifyRetry, type AdapterOutcome } from '@isp-search/domain';
import type { Logger } from '@isp-search/observability';
import type pg from 'pg';
import { PgBoss } from 'pg-boss';

/**
 * PostgreSQL-backed job queue built on pg-boss (ADR-006).
 *
 * Contract this wrapper enforces:
 *  - one job per (search, provider, adapter version) via `singletonKey`;
 *  - jobs are enqueued inside the caller's transaction so a search row and its jobs commit
 *    or roll back together;
 *  - retry attempts are bounded (uniform transient budget with backoff);
 *  - exhausted jobs move to a dead-letter queue whose payload contains identifiers only.
 *
 * Per-failure-class retry behaviour — explicit `unavailable` and user-action outcomes are never
 * retried — is defined and unit-tested here as `retryLimitForOutcome`, but it is enforced by the
 * M2 orchestration worker (PLA-367), which completes jobs with a typed outcome instead of
 * failing them. The queue-level `retryLimit` alone would retry any job a worker fails.
 */

export const QUEUES = {
  qualification: 'provider-qualification',
  qualificationDeadLetter: 'provider-qualification-dead',
  retention: 'retention-sweep',
} as const;

export interface QualificationJobData {
  /** Opaque identifiers only. Never an address. */
  readonly searchId: string;
  readonly providerId: string;
  readonly adapterVersion: string;
  readonly correlationId: string;
  /** ISO timestamp; work started after this must be discarded. */
  readonly deadlineAt: string;
}

export interface JobQueueOptions {
  readonly connectionString: string;
  readonly schema: string;
  readonly logger: Logger;
  /** Maximum active time for a qualification job before pg-boss treats the worker as dead. */
  readonly qualificationExpireSeconds?: number;
  readonly transientRetryLimit?: number;
  readonly maintenanceIntervalSeconds?: number;
  /** How often pg-boss checks for expired active jobs (default 60s). Tests lower it. */
  readonly superviseIntervalSeconds?: number;
  /** How often pg-boss re-evaluates a queue's expired jobs during supervision. Tests lower it. */
  readonly monitorIntervalSeconds?: number;
}

export interface EnqueueQualificationOptions {
  readonly data: QualificationJobData;
  /** Transaction-bound pg client. The job is written with this client, not the pool. */
  readonly client: pg.PoolClient | pg.Client;
  readonly startAfterSeconds?: number;
}

export function qualificationSingletonKey(data: QualificationJobData): string {
  return `${data.searchId}:${data.providerId}:${data.adapterVersion}`;
}

/** Retry policy by failure class. Explicit results and user actions never retry. */
export function retryLimitForOutcome(outcome: AdapterOutcome, transientRetryLimit: number): number {
  switch (classifyRetry(outcome)) {
    case 'none':
      return 0;
    case 'transient':
      return transientRetryLimit;
    case 'maintenance':
      return 0;
  }
}

export class JobQueue {
  readonly #boss: PgBoss;
  readonly #logger: Logger;
  readonly #transientRetryLimit: number;
  readonly #qualificationExpireSeconds: number;
  #started = false;

  constructor(options: JobQueueOptions) {
    this.#logger = options.logger;
    this.#transientRetryLimit = options.transientRetryLimit ?? 3;
    this.#qualificationExpireSeconds = options.qualificationExpireSeconds ?? 60;
    this.#boss = new PgBoss({
      connectionString: options.connectionString,
      schema: options.schema,
      application_name: 'isp-search-queue',
      max: 4,
      ...(options.maintenanceIntervalSeconds !== undefined
        ? { maintenanceIntervalSeconds: options.maintenanceIntervalSeconds }
        : {}),
      ...(options.superviseIntervalSeconds !== undefined
        ? { superviseIntervalSeconds: options.superviseIntervalSeconds }
        : {}),
      ...(options.monitorIntervalSeconds !== undefined
        ? { monitorIntervalSeconds: options.monitorIntervalSeconds }
        : {}),
    });
    this.#boss.on('error', (error: Error) => {
      this.#logger.error({ err: error }, 'job queue error');
    });
  }

  get boss(): PgBoss {
    return this.#boss;
  }

  get isStarted(): boolean {
    return this.#started;
  }

  get transientRetryLimit(): number {
    return this.#transientRetryLimit;
  }

  /** Starts pg-boss (creating its schema on first run) and ensures the queues exist. */
  async start(): Promise<void> {
    if (this.#started) return;
    await this.#boss.start();
    await this.#boss.createQueue(QUEUES.qualificationDeadLetter, {
      policy: 'standard',
      retryLimit: 0,
      retentionSeconds: 7 * 24 * 3600,
    });
    // `exclusive`: at most one queued-or-active job per singletonKey. With the default
    // `standard` policy pg-boss only dedupes singletonKey inside a `singletonSeconds` slot.
    await this.#boss.createQueue(QUEUES.qualification, {
      policy: 'exclusive',
      retryLimit: this.#transientRetryLimit,
      retryDelay: 2,
      retryBackoff: true,
      retryDelayMax: 30,
      expireInSeconds: this.#qualificationExpireSeconds,
      retentionSeconds: 24 * 3600,
      deleteAfterSeconds: 24 * 3600,
      deadLetter: QUEUES.qualificationDeadLetter,
    });
    await this.#boss.createQueue(QUEUES.retention, {
      policy: 'singleton',
      retryLimit: 1,
      retentionSeconds: 24 * 3600,
    });
    this.#started = true;
  }

  /**
   * Enqueue a qualification job using the caller's transaction client. Returns the job id, or
   * `null` when an identical (search, provider, adapter version) job is already queued or active.
   */
  async enqueueQualification(options: EnqueueQualificationOptions): Promise<string | null> {
    const client = options.client;
    const id = await this.#boss.send(QUEUES.qualification, options.data, {
      singletonKey: qualificationSingletonKey(options.data),
      ...(options.startAfterSeconds !== undefined ? { startAfter: options.startAfterSeconds } : {}),
      db: {
        executeSql: async (text: string, values?: unknown[]) => {
          const result = await client.query(text, values);
          return { rows: result.rows as Record<string, unknown>[] };
        },
      },
    });
    return id;
  }

  async stop(
    options: { readonly graceful?: boolean; readonly timeoutMs?: number } = {},
  ): Promise<void> {
    if (!this.#started) return;
    await this.#boss.stop({
      graceful: options.graceful ?? true,
      timeout: options.timeoutMs ?? 10_000,
      close: true,
    });
    this.#started = false;
  }
}

export function createJobQueue(options: JobQueueOptions): JobQueue {
  return new JobQueue(options);
}
