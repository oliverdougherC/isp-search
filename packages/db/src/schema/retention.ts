import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { retentionDataClass } from './enums.js';

/**
 * Deletion audit (PLA-362, ADR-007). Records that deletions happened and how many rows they
 * removed — never what was deleted. Search ids are opaque and safe; no address-derived value
 * may ever be written here.
 */
export const retentionEvents = pgTable(
  'retention_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dataClass: retentionDataClass('data_class').notNull(),
    /** Opaque sweep-run correlation id. */
    sweepRunId: text('sweep_run_id').notNull(),
    /** Opaque search id when the deletion was search-scoped. */
    searchId: text('search_id'),
    deletedCount: integer('deleted_count').notNull(),
    /** Typed trigger: `job_completion`, `scheduled_sweep`, `expiry`, `manual`. */
    trigger: text('trigger').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('retention_events_occurred_idx').on(table.occurredAt)],
);

export type RetentionEventRow = typeof retentionEvents.$inferSelect;
