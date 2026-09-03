import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseHandle {
  readonly db: Database;
  readonly pool: pg.Pool;
  close(): Promise<void>;
}

export interface CreateDatabaseOptions {
  readonly connectionString: string;
  readonly applicationName: string;
  readonly max?: number;
}

/**
 * Create a pooled Drizzle client. Each process owns its pool and must call `close()` during
 * graceful shutdown. The connection string is never logged.
 */
export function createDatabase(options: CreateDatabaseOptions): DatabaseHandle {
  const pool = new pg.Pool({
    connectionString: options.connectionString,
    application_name: options.applicationName,
    max: options.max ?? 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });
  // Idle-client failures (a restarting/stopped database) must degrade queries, not crash the
  // process with an unhandled 'error' event; readiness reports the outage instead.
  pool.on('error', () => {
    // deliberately quiet: pg surfaces the same failure on the next query, where callers log it
  });
  const db = drizzle(pool, { schema, casing: 'snake_case' });
  return {
    db,
    pool,
    close: async () => {
      await pool.end();
    },
  };
}

/**
 * Runs `fn` inside one database transaction, exposing BOTH the Drizzle view and the raw
 * client. The raw client exists so pg-boss can enqueue within the same transaction
 * (`send(..., { db: { executeSql } })`, ADR-006): a search row and its jobs commit or roll
 * back together.
 */
export async function withTransaction<T>(
  handle: DatabaseHandle,
  fn: (tx: Database, client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await handle.pool.connect();
  try {
    await client.query('begin');
    const tx = drizzle(client, { schema, casing: 'snake_case' });
    const result = await fn(tx, client);
    await client.query('commit');
    return result;
  } catch (error) {
    try {
      await client.query('rollback');
    } catch {
      // the connection is torn down below either way
    }
    throw error;
  } finally {
    client.release();
  }
}
