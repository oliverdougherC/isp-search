import {
  AddressOffer,
  CatalogPlan,
  computeFreshness,
  type FreshnessPolicy,
  type FreshnessState,
} from '@isp-search/domain';
import { and, eq, gt } from 'drizzle-orm';

import type { Database, DatabaseHandle } from './client.js';
import { addressOffers, catalogPlans, evidenceRecords } from './schema/index.js';

/**
 * Layered caches (PLA-369, ADR-005/007). Two deliberately separate cache classes:
 *
 *  - the CATALOG cache: provider plans shared across addresses. Reading it can never satisfy
 *    an address query — rows contain `kind: 'catalog_plan'` objects, and the address-offer
 *    table's CHECK rejects them, so the "generic data becomes address availability" failure
 *    mode is structurally impossible.
 *  - the QUALIFICATION cache: address-specific offers keyed by the versioned HMAC identity.
 *    Reuse requires the same identity, identity key version, provider, and adapter version,
 *    and an unexpired row — so a rotation, unit change, or parser upgrade silently misses
 *    instead of colliding.
 */

export interface CatalogCachePolicy {
  /** Catalog observations live at most this long (independent of the 7-day offer ceiling). */
  readonly ttlHours: number;
}

export async function upsertCatalogPlan(
  db: Database,
  input: {
    readonly plan: CatalogPlan;
    readonly observedAt: Date;
    readonly policy: CatalogCachePolicy;
    readonly evidenceId?: string;
  },
): Promise<void> {
  const plan = CatalogPlan.parse(input.plan);
  const parserVersion = plan.provenance.parserVersion ?? 'unversioned';
  await db
    .insert(catalogPlans)
    .values({
      providerId: plan.providerId,
      planKey: plan.planKey,
      parserVersion,
      plan: plan,
      evidenceId: input.evidenceId ?? null,
      observedAt: input.observedAt,
      expiresAt: new Date(input.observedAt.getTime() + input.policy.ttlHours * 3600 * 1000),
    })
    .onConflictDoUpdate({
      target: [catalogPlans.providerId, catalogPlans.planKey, catalogPlans.parserVersion],
      set: {
        plan: plan,
        evidenceId: input.evidenceId ?? null,
        observedAt: input.observedAt,
        expiresAt: new Date(input.observedAt.getTime() + input.policy.ttlHours * 3600 * 1000),
      },
    });
}

export interface CachedCatalogPlan {
  readonly plan: CatalogPlan;
  readonly observedAt: Date;
  readonly parserVersion: string;
  readonly freshness: FreshnessState;
}

const CATALOG_DISPLAY_FRESHNESS: FreshnessPolicy = {
  staleAfterMs: 24 * 3600 * 1000,
  expireAfterMs: Number.POSITIVE_INFINITY, // hard expiry is the row's own expires_at
};

/**
 * Reads unexpired catalog observations for a provider. Multiple parser versions coexist
 * deliberately — a version change adds rows rather than overwriting history.
 */
export async function readCatalogPlans(
  handle: DatabaseHandle,
  providerId: string,
  now: Date,
): Promise<CachedCatalogPlan[]> {
  const rows = await handle.db
    .select()
    .from(catalogPlans)
    .where(and(eq(catalogPlans.providerId, providerId), gt(catalogPlans.expiresAt, now)));
  const cached: CachedCatalogPlan[] = [];
  for (const row of rows) {
    const parsed = CatalogPlan.safeParse(row.plan);
    if (!parsed.success) continue;
    cached.push({
      plan: parsed.data,
      observedAt: row.observedAt,
      parserVersion: row.parserVersion,
      freshness: computeFreshness(row.observedAt, CATALOG_DISPLAY_FRESHNESS, now),
    });
  }
  return cached;
}

export interface ReusableQualification {
  readonly offers: readonly AddressOffer[];
  readonly retrievedAt: Date;
  readonly expiresAt: Date;
  readonly evidenceId: string | null;
}

/**
 * The exact-address qualification cache read: unexpired offers observed for the SAME
 * versioned address identity, provider, and adapter version, from any earlier search.
 */
export async function findReusableQualification(
  db: Database,
  input: {
    readonly addressIdentity: string;
    readonly addressIdentityVersion: number;
    readonly providerId: string;
    readonly adapterVersion: string;
    readonly now: Date;
  },
): Promise<ReusableQualification | null> {
  const rows = await db
    .select()
    .from(addressOffers)
    .where(
      and(
        eq(addressOffers.addressIdentity, input.addressIdentity),
        eq(addressOffers.addressIdentityVersion, input.addressIdentityVersion),
        eq(addressOffers.providerId, input.providerId),
        eq(addressOffers.adapterVersion, input.adapterVersion),
        gt(addressOffers.expiresAt, input.now),
      ),
    );
  if (rows.length === 0) return null;
  const offers: AddressOffer[] = [];
  let retrievedAt = rows[0]?.retrievedAt ?? input.now;
  let expiresAt = rows[0]?.expiresAt ?? input.now;
  for (const row of rows) {
    const parsed = AddressOffer.safeParse(row.offer);
    if (parsed.success) offers.push(parsed.data);
    if (row.retrievedAt < retrievedAt) retrievedAt = row.retrievedAt;
    if (row.expiresAt < expiresAt) expiresAt = row.expiresAt;
  }
  if (offers.length === 0) return null;
  return { offers, retrievedAt, expiresAt, evidenceId: rows[0]?.evidenceId ?? null };
}

/** Copies a provenance row so the cached observation keeps its original metadata. */
export async function copyEvidenceRecord(db: Database, evidenceId: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(evidenceRecords)
    .where(eq(evidenceRecords.id, evidenceId))
    .limit(1);
  if (!row) return null;
  const [inserted] = await db
    .insert(evidenceRecords)
    .values({
      provenance: row.provenance,
      sourceType: row.sourceType,
      retrievedAt: row.retrievedAt,
      contentHash: row.contentHash,
    })
    .returning({ id: evidenceRecords.id });
  return inserted?.id ?? null;
}
