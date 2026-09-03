import { randomBytes } from 'node:crypto';

import { SETTLED_PROVIDER_JOB_STATES, TERMINAL_SEARCH_STATES } from '@isp-search/domain';
import { and, eq, inArray, isNotNull, lte, sql } from 'drizzle-orm';

import type { Database } from './client.js';
import {
  addressOffers,
  catalogPlans,
  qualificationJobs,
  retentionEvents,
  searchAddressMaterial,
  searches,
} from './schema/index.js';

/**
 * Retention and deletion (PLA-362, ADR-007).
 *
 * Two mechanisms, both idempotent:
 *  - early deletion: the moment every provider job of a search has settled, the encrypted raw
 *    address is deleted (completion should not wait for the TTL);
 *  - the scheduled sweep: TTL-driven cleanup for everything else and as the safety net when a
 *    crash prevented early deletion.
 *
 * The audit table records counts and opaque ids only — deletion must never re-record what it
 * deleted.
 */

export type RetentionTrigger = 'job_completion' | 'scheduled_sweep' | 'expiry' | 'manual';

export function newSweepRunId(): string {
  return `sweep_${randomBytes(8).toString('hex')}`;
}

async function audit(
  db: Database,
  entry: {
    dataClass:
      | 'raw_address'
      | 'search_display_data'
      | 'expired_search'
      | 'address_offers'
      | 'provider_artifacts'
      | 'catalog_plans';
    sweepRunId: string;
    searchId?: string;
    deletedCount: number;
    trigger: RetentionTrigger;
    occurredAt: Date;
  },
): Promise<void> {
  if (entry.deletedCount === 0) return;
  await db.insert(retentionEvents).values({
    dataClass: entry.dataClass,
    sweepRunId: entry.sweepRunId,
    searchId: entry.searchId ?? null,
    deletedCount: entry.deletedCount,
    trigger: entry.trigger,
    occurredAt: entry.occurredAt,
  });
}

/** Deletes one search's encrypted raw address material. Idempotent. */
export async function deleteRawAddress(
  db: Database,
  searchId: string,
  options: { readonly trigger: RetentionTrigger; readonly sweepRunId: string; readonly now: Date },
): Promise<number> {
  const deleted = await db
    .delete(searchAddressMaterial)
    .where(eq(searchAddressMaterial.searchId, searchId))
    .returning({ searchId: searchAddressMaterial.searchId });
  await audit(db, {
    dataClass: 'raw_address',
    sweepRunId: options.sweepRunId,
    searchId,
    deletedCount: deleted.length,
    trigger: options.trigger,
    occurredAt: options.now,
  });
  return deleted.length;
}

/**
 * Early deletion: removes the raw address as soon as every provider job for the search has
 * settled (succeeded/degraded/failed_terminal/expired). A search that is paused on a user
 * action still has unsettled work, so its material is kept until resume or TTL.
 */
export async function deleteRawAddressIfAllSettled(
  db: Database,
  searchId: string,
  options: { readonly sweepRunId: string; readonly now: Date },
): Promise<boolean> {
  const jobs = await db
    .select({ state: qualificationJobs.state })
    .from(qualificationJobs)
    .where(eq(qualificationJobs.searchId, searchId));
  if (jobs.length === 0) return false;
  const settled = SETTLED_PROVIDER_JOB_STATES as ReadonlySet<string>;
  const allSettled = jobs.every((job) => settled.has(job.state));
  if (!allSettled) return false;
  await deleteRawAddress(db, searchId, {
    trigger: 'job_completion',
    sweepRunId: options.sweepRunId,
    now: options.now,
  });
  return true;
}

export interface SweepSummary {
  readonly sweepRunId: string;
  readonly rawAddressRows: number;
  readonly displayWipedSearches: number;
  readonly expiredSearches: number;
  readonly deletedOffers: number;
  readonly deletedCatalogPlans: number;
  /** Typed codes of steps that failed; the sweep continues past individual failures. */
  readonly failures: readonly string[];
}

/**
 * The scheduled retention sweep. Every step is idempotent and independent: a failure in one
 * class is recorded and does not stop the others (partial-failure tolerance, PLA-362).
 */
export async function sweepRetention(
  db: Database,
  now: Date,
  sweepRunId: string = newSweepRunId(),
): Promise<SweepSummary> {
  const failures: string[] = [];
  let rawAddressRows = 0;
  let displayWipedSearches = 0;
  let expiredSearches = 0;
  let deletedOffers = 0;
  let deletedCatalogPlans = 0;

  // 1. Raw address material past its ceiling — deleted even when jobs are still running.
  try {
    const deleted = await db
      .delete(searchAddressMaterial)
      .where(lte(searchAddressMaterial.expiresAt, now))
      .returning({ searchId: searchAddressMaterial.searchId });
    rawAddressRows = deleted.length;
    await audit(db, {
      dataClass: 'raw_address',
      sweepRunId,
      deletedCount: deleted.length,
      trigger: 'scheduled_sweep',
      occurredAt: now,
    });
  } catch {
    failures.push('raw_address_sweep_failed');
  }

  // 2. Expired searches: wipe the display tier (address-derived fields) and, where the state
  //    machine allows, move the search to `expired`. Terminal searches keep their state; the
  //    API treats `expiresAt` as authoritative for serving behavior.
  try {
    const wiped = await db
      .update(searches)
      .set({
        displayAddress: null,
        addressCandidates: null,
        unitOptions: null,
        updatedAt: now,
      })
      .where(and(lte(searches.expiresAt, now), isNotNull(searches.displayAddress)))
      .returning({ id: searches.id });
    displayWipedSearches = wiped.length;
    await audit(db, {
      dataClass: 'search_display_data',
      sweepRunId,
      deletedCount: wiped.length,
      trigger: 'scheduled_sweep',
      occurredAt: now,
    });
    const terminal = TERMINAL_SEARCH_STATES as ReadonlySet<string>;
    const nonTerminal = [...searches.state.enumValues].filter((state) => !terminal.has(state));
    const expired = await db
      .update(searches)
      .set({ state: 'expired', updatedAt: now })
      .where(and(lte(searches.expiresAt, now), inArray(searches.state, nonTerminal)))
      .returning({ id: searches.id });
    expiredSearches = expired.length;
    await audit(db, {
      dataClass: 'expired_search',
      sweepRunId,
      deletedCount: expired.length,
      trigger: 'expiry',
      occurredAt: now,
    });
  } catch {
    failures.push('search_expiry_sweep_failed');
  }

  // 3. Address-specific offers past the offer-cache ceiling.
  try {
    const deleted = await db
      .delete(addressOffers)
      .where(lte(addressOffers.expiresAt, now))
      .returning({ id: addressOffers.id });
    deletedOffers = deleted.length;
    await audit(db, {
      dataClass: 'address_offers',
      sweepRunId,
      deletedCount: deleted.length,
      trigger: 'scheduled_sweep',
      occurredAt: now,
    });
  } catch {
    failures.push('address_offers_sweep_failed');
  }

  // 4. Catalog-plan observations past their cache expiry.
  try {
    const deleted = await db
      .delete(catalogPlans)
      .where(lte(catalogPlans.expiresAt, now))
      .returning({ id: catalogPlans.id });
    deletedCatalogPlans = deleted.length;
    await audit(db, {
      dataClass: 'catalog_plans',
      sweepRunId,
      deletedCount: deleted.length,
      trigger: 'scheduled_sweep',
      occurredAt: now,
    });
  } catch {
    failures.push('catalog_plans_sweep_failed');
  }

  // Keep the audit table itself bounded (audit rows are counts only; 90 days is plenty).
  try {
    await db
      .delete(retentionEvents)
      .where(
        lte(
          retentionEvents.occurredAt,
          sql`${now.toISOString()}::timestamptz - interval '90 days'`,
        ),
      );
  } catch {
    failures.push('audit_prune_failed');
  }

  return {
    sweepRunId,
    rawAddressRows,
    displayWipedSearches,
    expiredSearches,
    deletedOffers,
    deletedCatalogPlans,
    failures,
  };
}
