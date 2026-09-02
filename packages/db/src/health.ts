import { sql } from 'drizzle-orm';

import type { DatabaseHandle } from './client.js';
import { readMigrationJournal } from './migrations.js';

export interface HealthCheckResult {
  readonly status: 'ok' | 'error';
  readonly latencyMs: number;
  readonly detail?: string;
}

export interface ReadinessResult {
  readonly status: 'ready' | 'not_ready';
  readonly checks: {
    readonly connectivity: HealthCheckResult;
    readonly migrations: {
      readonly status: 'ok' | 'pending' | 'error';
      readonly applied: number;
      readonly expected: number;
      readonly detail?: string;
    };
  };
}

/** Liveness: can we get a connection and run a trivial query? */
export async function checkDatabaseHealth(handle: DatabaseHandle): Promise<HealthCheckResult> {
  const started = performance.now();
  try {
    await handle.db.execute(sql`select 1`);
    return { status: 'ok', latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: Math.round(performance.now() - started),
      detail: error instanceof Error ? error.name : 'unknown_error',
    };
  }
}

/**
 * Readiness: connectivity plus all migrations applied. Compares the drizzle migration table
 * with the committed journal, so a deploy that forgot to migrate reports `not_ready` instead
 * of failing on first query.
 */
export async function checkDatabaseReadiness(handle: DatabaseHandle): Promise<ReadinessResult> {
  const connectivity = await checkDatabaseHealth(handle);
  const expected = readMigrationJournal().entries.length;
  if (connectivity.status !== 'ok') {
    return {
      status: 'not_ready',
      checks: { connectivity, migrations: { status: 'error', applied: 0, expected } },
    };
  }
  try {
    const result = await handle.db.execute<{ count: string }>(
      sql`select count(*)::text as count from drizzle.__drizzle_migrations`,
    );
    const applied = Number(result.rows[0]?.count ?? '0');
    const status = applied >= expected ? 'ok' : 'pending';
    return {
      status: status === 'ok' ? 'ready' : 'not_ready',
      checks: { connectivity, migrations: { status, applied, expected } },
    };
  } catch (error) {
    return {
      status: 'not_ready',
      checks: {
        connectivity,
        migrations: {
          status: 'error',
          applied: 0,
          expected,
          detail: error instanceof Error ? error.name : 'unknown_error',
        },
      },
    };
  }
}
