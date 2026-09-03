import {
  API_VERSION,
  AddressOffer,
  CandidateEvidence,
  completenessStatement,
  computeFreshness,
  deriveProviderAvailability,
  isApprovedOfficialUrl,
  SearchResource,
  type AdapterOutcome,
  type CandidateEvidenceClass,
  type EvidenceSummary,
  type FreshnessPolicy,
  type ProviderResult,
} from '@isp-search/domain';
import { eq, inArray } from 'drizzle-orm';

import type { DatabaseHandle } from './client.js';
import {
  addressOffers,
  launchMarkets,
  providerBrands,
  qualificationJobs,
  searchCandidates,
  searches,
} from './schema/index.js';
import { isSearchExpired } from './sessions.js';

/**
 * The public read model (PLA-368/369): assembles the versioned `SearchResource` from
 * persistence. All confidence semantics are derived HERE via `deriveProviderAvailability` —
 * nothing stored can upgrade weak evidence, and no vendor shape can leak because everything is
 * validated against the domain contract before it leaves.
 */

const DEFAULT_FCC_MAP_URL = 'https://broadbandmap.fcc.gov/';
const POLL_ACTIVE_MS = 1_500;
const POLL_SETTLED_MS = 10_000;

/** Evidence display freshness: stale after 30 days, expired after 90 (review cadence). */
const EVIDENCE_FRESHNESS: FreshnessPolicy = {
  staleAfterMs: 30 * 24 * 3600 * 1000,
  expireAfterMs: 90 * 24 * 3600 * 1000,
};

export type SearchReadResult =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'expired' }
  | { readonly kind: 'ok'; readonly resource: SearchResource };

export async function buildSearchResource(
  handle: DatabaseHandle,
  searchId: string,
  now: Date,
): Promise<SearchReadResult> {
  // Opaque-id shape check first: anything else is indistinguishable from absence.
  if (!/^[A-Za-z0-9_-]{43}$/.test(searchId)) return { kind: 'not_found' };
  const [search] = await handle.db
    .select()
    .from(searches)
    .where(eq(searches.id, searchId))
    .limit(1);
  if (!search) return { kind: 'not_found' };
  if (isSearchExpired(search, now)) return { kind: 'expired' };

  const [candidates, jobs, offers, market] = await Promise.all([
    handle.db.select().from(searchCandidates).where(eq(searchCandidates.searchId, searchId)),
    handle.db.select().from(qualificationJobs).where(eq(qualificationJobs.searchId, searchId)),
    handle.db.select().from(addressOffers).where(eq(addressOffers.searchId, searchId)),
    search.marketId
      ? handle.db
          .select()
          .from(launchMarkets)
          .where(eq(launchMarkets.id, search.marketId))
          .limit(1)
          .then((rows) => rows[0])
      : Promise.resolve(undefined),
  ]);

  const providerIds = [
    ...new Set([...candidates.map((row) => row.providerId), ...jobs.map((row) => row.providerId)]),
  ];
  const brands = providerIds.length
    ? await handle.db.select().from(providerBrands).where(inArray(providerBrands.id, providerIds))
    : [];
  const brandById = new Map(brands.map((brand) => [brand.id, brand]));

  const providers: ProviderResult[] = [];
  for (const providerId of providerIds.sort()) {
    const brand = brandById.get(providerId);
    const providerCandidates = candidates.filter((row) => row.providerId === providerId);
    // Latest adapter version wins for display; older versions remain in history.
    const job = jobs
      .filter((row) => row.providerId === providerId)
      .sort((a, b) => b.adapterVersion.localeCompare(a.adapterVersion))[0];
    const evidence: EvidenceSummary[] = [];
    const evidenceClasses: CandidateEvidenceClass[] = [];
    for (const row of providerCandidates) {
      const parsed = CandidateEvidence.safeParse(row.evidence);
      if (!parsed.success) continue;
      evidenceClasses.push(parsed.data.evidenceClass);
      evidence.push({
        evidenceClass: parsed.data.evidenceClass,
        sourceType: parsed.data.provenance.sourceType,
        sourceUrl: parsed.data.provenance.sourceUrl,
        retrievedAt: parsed.data.provenance.retrievedAt,
        dataVintage: parsed.data.provenance.dataVintage,
        lastReviewed: parsed.data.provenance.lastReviewed,
        geographicPrecision: parsed.data.provenance.geographicPrecision,
        limitations: parsed.data.provenance.limitations,
        freshness: computeFreshness(
          new Date(parsed.data.provenance.retrievedAt),
          EVIDENCE_FRESHNESS,
          now,
        ),
      });
    }
    // Only a SETTLED explicit outcome participates in availability derivation.
    const settledOutcome: AdapterOutcome | null =
      job && job.settledAt !== null ? (job.outcome ?? null) : null;
    const derived = deriveProviderAvailability({
      outcome: settledOutcome,
      candidateEvidence: evidenceClasses,
    });
    const providerOffers: AddressOffer[] = [];
    for (const row of offers.filter((offerRow) => offerRow.providerId === providerId)) {
      const parsed = AddressOffer.safeParse(row.offer);
      if (parsed.success) providerOffers.push(parsed.data);
    }
    const approvedHosts = brand?.approvedLinkHosts ?? [];
    const links: { homepage?: string; availability?: string } = {};
    const homepage = brand?.officialLinks.homepage;
    if (homepage !== undefined && isApprovedOfficialUrl(homepage, approvedHosts)) {
      links.homepage = homepage;
    }
    const availabilityLink = brand?.officialLinks.availability;
    if (availabilityLink !== undefined && isApprovedOfficialUrl(availabilityLink, approvedHosts)) {
      links.availability = availabilityLink;
    }
    providers.push({
      providerId,
      displayName: brand?.displayName ?? providerId,
      technologies: (brand?.technologies ?? []) as ProviderResult['technologies'],
      adapterTier:
        brand?.integrationTier === 'reference_fixture'
          ? 'reference_fixture'
          : brand?.integrationTier === 'link_only'
            ? 'link_only'
            : null,
      capacityBasedEligibility: providerCandidates.some(
        (row) => CandidateEvidence.safeParse(row.evidence).data?.capacityBasedEligibility === true,
      ),
      availability: derived.state,
      availabilityBasis: derived.basis,
      jobState: job?.state ?? null,
      outcome: settledOutcome,
      diagnosticCode: job?.lastDiagnosticCode ?? null,
      actionRequired:
        job?.state === 'action_required' ? { options: [...(job.actionOptions ?? [])] } : null,
      officialLinks: links,
      evidence,
      offers: providerOffers,
      qualifiedAt: job?.settledAt?.toISOString() ?? null,
    });
  }

  const active = search.state === 'qualifying' || search.state === 'partial';
  const resource: SearchResource = SearchResource.parse({
    apiVersion: API_VERSION,
    id: search.id,
    state: search.state,
    reasonCode: search.reasonCode,
    displayAddress: search.displayAddress,
    requiredAction: search.requiredAction as SearchResource['requiredAction'],
    addressCandidates: [...(search.addressCandidates ?? [])],
    unitOptions: [...(search.unitOptions ?? [])],
    actionEpoch: search.actionEpoch,
    market: market
      ? {
          supported: true,
          id: market.id,
          name: market.name,
          status: market.status,
          registryVersion: market.registryVersion,
          lastReviewed: market.lastReviewed,
          bdcVintage: market.bdcVintage,
          attribution: 'Source data: FCC Broadband Data Collection',
        }
      : search.reasonCode === 'unsupported_market'
        ? {
            supported: false,
            id: null,
            name: null,
            status: null,
            registryVersion: search.registryVersion,
            lastReviewed: null,
            bdcVintage: null,
            attribution: null,
          }
        : null,
    completenessStatement: completenessStatement(market?.lastReviewed ?? 'not yet reviewed'),
    fccMapUrl: DEFAULT_FCC_MAP_URL,
    pollIntervalMs: active ? POLL_ACTIVE_MS : POLL_SETTLED_MS,
    deadlineAt: search.deadlineAt.toISOString(),
    createdAt: search.createdAt.toISOString(),
    expiresAt: search.expiresAt.toISOString(),
    providers,
  });
  return { kind: 'ok', resource };
}
