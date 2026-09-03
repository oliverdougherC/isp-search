import { DiscoveryUnavailableError, type CandidateDiscovery } from '@isp-search/discovery';
import {
  CandidateEvidence,
  assertProviderJobTransition,
  assertTransition,
  canTransition,
  classifyRetry,
  computeSearchPhase,
  settledJobStateForOutcome,
  type AdapterOutcome,
  type AddressOffer,
  type Provenance,
  type SearchState,
} from '@isp-search/domain';
import { and, eq, inArray, lte } from 'drizzle-orm';

import { openAddressMaterial } from './address-material.js';
import { withTransaction, type Database, type DatabaseHandle } from './client.js';
import type { JobQueue, QualificationJobData } from './queue/index.js';
import { deleteRawAddressIfAllSettled, deleteRawAddress, newSweepRunId } from './retention.js';
import {
  addressOffers,
  evidenceRecords,
  offerConditions,
  offerPriceComponents,
  providerHealth,
  qualificationAttempts,
  qualificationJobs,
  searchAddressMaterial,
  searchCandidates,
  searches,
} from './schema/index.js';
import { isSearchExpired, type SessionPolicy } from './sessions.js';

/**
 * Search orchestration (PLA-367) on top of the proven queue (ADR-006).
 *
 * Responsibilities: transactional candidate/job fan-out, per-outcome retry policy, the global
 * deadline and late-result rule, duplicate-delivery convergence, failure isolation (one
 * provider can never hide another's results), and deterministic partial/complete aggregation.
 */

export interface OrchestrationDeps {
  readonly queue: JobQueue;
  readonly discovery: CandidateDiscovery;
  /** Adapter version for a provider, or null when no adapter exists (link-only candidate). */
  readonly adapterVersionFor: (providerId: string) => string | null;
  readonly isProviderEnabled: (providerId: string) => boolean;
  readonly policy: SessionPolicy;
  readonly now: () => Date;
  /** Offer-cache lifetime; ADR-007 ceiling is 7 days. */
  readonly offerTtlDays?: number;
}

export type StartQualificationResult =
  | { readonly status: 'unsupported_market' }
  | { readonly status: 'discovery_unavailable' }
  | { readonly status: 'already_started'; readonly state: SearchState }
  | { readonly status: 'not_startable'; readonly state: SearchState }
  | {
      readonly status: 'started';
      readonly candidates: number;
      readonly jobs: number;
      readonly state: SearchState;
    };

/**
 * Discovery + fan-out for a search whose address has resolved. Candidates, jobs, queue sends,
 * and the search-state transition commit in ONE transaction. Idempotent: a second call finds
 * the search past `resolving_address` and does nothing.
 */
export async function startQualification(
  handle: DatabaseHandle,
  searchId: string,
  deps: OrchestrationDeps,
): Promise<StartQualificationResult> {
  const now = deps.now();
  return withTransaction(handle, async (tx, client) => {
    const [search] = await tx
      .select()
      .from(searches)
      .where(eq(searches.id, searchId))
      .for('update')
      .limit(1);
    if (!search) return { status: 'not_startable', state: 'failed' as const };
    if (search.state !== 'resolving_address') {
      return { status: 'already_started', state: search.state };
    }
    const [material] = await tx
      .select()
      .from(searchAddressMaterial)
      .where(eq(searchAddressMaterial.searchId, searchId))
      .limit(1);
    if (!material) {
      await tx
        .update(searches)
        .set({
          state: assertTransition(search.state, 'failed'),
          reasonCode: 'raw_address_unavailable',
          updatedAt: now,
        })
        .where(eq(searches.id, searchId));
      return { status: 'not_startable', state: 'failed' };
    }
    const opened = openAddressMaterial(
      material.ciphertext,
      material.keyVersion,
      deps.policy.rawAddressKey,
    );

    let discovery;
    try {
      discovery = await deps.discovery.discover({ scope: opened.resolved.scope, now });
    } catch (error) {
      if (error instanceof DiscoveryUnavailableError) {
        await tx
          .update(searches)
          .set({
            state: assertTransition(search.state, 'failed'),
            reasonCode: 'discovery_unavailable',
            updatedAt: now,
          })
          .where(eq(searches.id, searchId));
        return { status: 'discovery_unavailable' };
      }
      throw error;
    }

    const discovering = assertTransition(search.state, 'discovering_candidates');
    if (discovery.status === 'unsupported_market') {
      await tx
        .update(searches)
        .set({
          state: assertTransition(discovering, 'complete'),
          reasonCode: 'unsupported_market',
          registryVersion: discovery.registryVersion,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(searches.id, searchId));
      // No provider will ever need this address; delete the raw material immediately.
      await deleteRawAddress(tx, searchId, {
        trigger: 'search_completion',
        sweepRunId: newSweepRunId(),
        now,
      });
      return { status: 'unsupported_market' };
    }

    let jobs = 0;
    for (const candidate of discovery.candidates) {
      for (const evidence of candidate.evidence) {
        const validated = CandidateEvidence.parse(evidence);
        await tx
          .insert(searchCandidates)
          .values({
            searchId,
            providerId: candidate.providerId,
            evidenceClass: validated.evidenceClass,
            evidence: validated,
          })
          .onConflictDoNothing();
      }
      const adapterVersion = deps.adapterVersionFor(candidate.providerId);
      if (adapterVersion === null || candidate.adapterTier === 'link_only') continue;
      const enabled = deps.isProviderEnabled(candidate.providerId);
      const [health] = await tx
        .select({ circuitState: providerHealth.circuitState })
        .from(providerHealth)
        .where(eq(providerHealth.providerId, candidate.providerId))
        .limit(1);
      const circuitOpen = health?.circuitState === 'open';
      if (!enabled || circuitOpen) {
        // Typed degraded result, immediately settled; the official link stays available.
        await tx
          .insert(qualificationJobs)
          .values({
            searchId,
            providerId: candidate.providerId,
            adapterVersion,
            state: 'degraded',
            outcome: 'unknown',
            lastDiagnosticCode: circuitOpen ? 'circuit_open' : 'adapter_disabled',
            settledAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing();
        continue;
      }
      const [job] = await tx
        .insert(qualificationJobs)
        .values({ searchId, providerId: candidate.providerId, adapterVersion, updatedAt: now })
        .onConflictDoNothing()
        .returning({ id: qualificationJobs.id });
      if (job) {
        jobs += 1;
        const data: QualificationJobData = {
          searchId,
          providerId: candidate.providerId,
          adapterVersion,
          correlationId: `${searchId.slice(0, 8)}:${candidate.providerId}`,
          deadlineAt: search.deadlineAt.toISOString(),
        };
        await deps.queue.enqueueQualification({ data, client });
      }
    }

    const qualifying = assertTransition(discovering, 'qualifying');
    const jobStates = await tx
      .select({ state: qualificationJobs.state })
      .from(qualificationJobs)
      .where(eq(qualificationJobs.searchId, searchId));
    const phase = computeSearchPhase(
      jobStates.map((row) => row.state),
      { deadlinePassed: false },
    );
    const finalState = phase === 'qualifying' ? qualifying : assertTransition(qualifying, phase);
    await tx
      .update(searches)
      .set({
        state: finalState,
        marketId: discovery.market.id,
        registryVersion: discovery.market.registryVersion,
        ...(finalState === 'complete' ? { completedAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(searches.id, searchId));
    if (finalState === 'complete') {
      await deleteRawAddress(tx, searchId, {
        trigger: 'search_completion',
        sweepRunId: newSweepRunId(),
        now,
      });
    }
    return { status: 'started', candidates: discovery.candidates.length, jobs, state: finalState };
  });
}

/**
 * Recomputes the search phase from its job states and applies the transition when it changed.
 * Used after every settlement and by the deadline sweep. Never touches terminal searches.
 */
export async function recomputeSearchState(
  tx: Database,
  searchId: string,
  now: Date,
): Promise<SearchState | null> {
  const [search] = await tx
    .select()
    .from(searches)
    .where(eq(searches.id, searchId))
    .for('update')
    .limit(1);
  if (!search) return null;
  if (search.state !== 'qualifying' && search.state !== 'partial') return search.state;
  const jobStates = await tx
    .select({ state: qualificationJobs.state })
    .from(qualificationJobs)
    .where(eq(qualificationJobs.searchId, searchId));
  const phase = computeSearchPhase(
    jobStates.map((row) => row.state),
    { deadlinePassed: now.getTime() >= search.deadlineAt.getTime() },
  );
  if (phase === search.state || !canTransition(search.state, phase)) return search.state;
  await tx
    .update(searches)
    .set({
      state: phase,
      ...(phase === 'complete' ? { completedAt: now } : {}),
      updatedAt: now,
    })
    .where(eq(searches.id, searchId));
  return phase;
}

/** What the worker should do with a delivered queue message. */
export type JobClaim =
  | { readonly action: 'discard'; readonly reason: string }
  | {
      readonly action: 'run';
      readonly jobId: string;
      readonly attempt: number;
      readonly actionResponse: string | null;
    };

/**
 * Claims a delivered job: transitions it to `running` and returns what the adapter run needs.
 * Duplicate deliveries of a settled job and anything past the deadline or on a dead search are
 * discarded (with expired jobs settled as such), which is what makes at-least-once delivery
 * safe.
 */
export async function claimQualificationJob(
  handle: DatabaseHandle,
  data: QualificationJobData,
  now: Date,
): Promise<JobClaim> {
  return withTransaction(handle, async (tx) => {
    const [job] = await tx
      .select()
      .from(qualificationJobs)
      .where(
        and(
          eq(qualificationJobs.searchId, data.searchId),
          eq(qualificationJobs.providerId, data.providerId),
          eq(qualificationJobs.adapterVersion, data.adapterVersion),
        ),
      )
      .for('update')
      .limit(1);
    if (!job) return { action: 'discard', reason: 'job_row_missing' };
    if (job.state !== 'queued' && job.state !== 'running') {
      return { action: 'discard', reason: 'already_settled' };
    }
    const [search] = await tx
      .select()
      .from(searches)
      .where(eq(searches.id, data.searchId))
      .limit(1);
    const deadlinePassed = search ? now.getTime() >= search.deadlineAt.getTime() : true;
    if (!search || isSearchExpired(search, now) || deadlinePassed) {
      await tx
        .update(qualificationJobs)
        .set({
          state: assertProviderJobTransition(job.state, 'expired'),
          settledAt: now,
          lastDiagnosticCode: 'deadline_elapsed',
          updatedAt: now,
        })
        .where(eq(qualificationJobs.id, job.id));
      await recomputeSearchState(tx, data.searchId, now);
      await deleteRawAddressIfAllSettled(tx, data.searchId, {
        sweepRunId: newSweepRunId(),
        now,
      });
      return { action: 'discard', reason: 'deadline_elapsed' };
    }
    const attempt = job.attemptCount + 1;
    await tx
      .update(qualificationJobs)
      .set({
        state:
          job.state === 'running' ? job.state : assertProviderJobTransition(job.state, 'running'),
        attemptCount: attempt,
        startedAt: job.startedAt ?? now,
        updatedAt: now,
      })
      .where(eq(qualificationJobs.id, job.id));
    return { action: 'run', jobId: job.id, attempt, actionResponse: job.actionResponse };
  });
}

export interface AdapterRunResult {
  readonly outcome: AdapterOutcome;
  readonly evidence: {
    readonly sourceType: 'synthetic' | 'provider_qualification' | 'official_page';
    readonly sourceUrl?: string | undefined;
    readonly capturedAt: string;
    readonly adapterVersion: string;
    readonly parserVersion: string;
    readonly fingerprint: string;
  } | null;
  readonly offers?: readonly AddressOffer[];
  readonly actionOptions?: readonly string[];
  readonly diagnostics: Record<string, string | number | boolean>;
}

export type SettleDecision =
  | {
      readonly kind: 'settled';
      readonly jobState: string;
      readonly searchState: SearchState | null;
    }
  | { readonly kind: 'retry'; readonly nextAttemptDelaySeconds: number }
  | { readonly kind: 'late_discard' };

const EVIDENCE_SOURCE_MAP = {
  synthetic: 'synthetic',
  provider_qualification: 'provider_qualification',
  official_page: 'official_provider_page',
} as const;

function provenanceFromEvidence(
  evidence: NonNullable<AdapterRunResult['evidence']>,
  finishedAt: Date,
): Provenance {
  return {
    schemaVersion: 1,
    sourceType: EVIDENCE_SOURCE_MAP[evidence.sourceType],
    sourceDomain: evidence.sourceUrl ? new URL(evidence.sourceUrl).hostname : null,
    sourceUrl: evidence.sourceUrl ?? null,
    retrievedAt: finishedAt.toISOString(),
    dataVintage: null,
    lastReviewed: null,
    geographicPrecision: 'address',
    adapterVersion: evidence.adapterVersion,
    parserVersion: evidence.parserVersion,
    contentHash: evidence.fingerprint,
    limitations: [],
  };
}

/**
 * Records the attempt and either settles the job, schedules a bounded transient retry, or
 * discards a late result (finished past the global deadline). Offer persistence is idempotent
 * under the (search, provider, adapter version, offer key) unique.
 */
export async function settleQualificationJob(
  handle: DatabaseHandle,
  input: {
    readonly jobId: string;
    readonly data: QualificationJobData;
    readonly attempt: number;
    readonly result: AdapterRunResult;
    readonly startedAt: Date;
    readonly finishedAt: Date;
  },
  deps: OrchestrationDeps,
): Promise<SettleDecision> {
  const { jobId, data, attempt, result, startedAt, finishedAt } = input;
  const retryClass = classifyRetry(result.outcome);
  const transientBudgetLeft =
    retryClass === 'transient' && attempt <= deps.queue.transientRetryLimit;

  return withTransaction(handle, async (tx, client) => {
    const [job] = await tx
      .select()
      .from(qualificationJobs)
      .where(eq(qualificationJobs.id, jobId))
      .for('update')
      .limit(1);
    if (job?.state !== 'running') {
      return { kind: 'late_discard' };
    }
    const [search] = await tx
      .select()
      .from(searches)
      .where(eq(searches.id, data.searchId))
      .limit(1);
    if (!search) return { kind: 'late_discard' };

    let evidenceId: string | null = null;
    if (result.evidence) {
      const provenance = provenanceFromEvidence(result.evidence, finishedAt);
      const [inserted] = await tx
        .insert(evidenceRecords)
        .values({
          provenance: provenance,
          sourceType: provenance.sourceType,
          retrievedAt: finishedAt,
          contentHash: provenance.contentHash,
        })
        .returning({ id: evidenceRecords.id });
      evidenceId = inserted?.id ?? null;
    }
    await tx
      .insert(qualificationAttempts)
      .values({
        jobId,
        attemptNumber: attempt,
        outcome: result.outcome,
        retryClass,
        evidenceId,
        diagnostics: result.diagnostics,
        startedAt,
        finishedAt,
        latencyMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
      })
      .onConflictDoNothing();

    // Late-result rule: work that finishes after the global deadline is discarded, whatever
    // it says. The job expires; completed peers are already visible.
    if (finishedAt.getTime() >= search.deadlineAt.getTime()) {
      await tx
        .update(qualificationJobs)
        .set({
          state: assertProviderJobTransition('running', 'expired'),
          lastDiagnosticCode: 'late_result_discarded',
          settledAt: finishedAt,
          updatedAt: finishedAt,
        })
        .where(eq(qualificationJobs.id, jobId));
      await recomputeSearchState(tx, data.searchId, finishedAt);
      await deleteRawAddressIfAllSettled(tx, data.searchId, {
        sweepRunId: newSweepRunId(),
        now: finishedAt,
      });
      return { kind: 'late_discard' };
    }

    if (transientBudgetLeft) {
      // Bounded transient retry with exponential backoff, re-enqueued transactionally.
      const delay = Math.min(30, 2 ** attempt);
      await tx
        .update(qualificationJobs)
        .set({
          state: assertProviderJobTransition('running', 'queued'),
          lastDiagnosticCode: `transient_${result.outcome}`,
          updatedAt: finishedAt,
        })
        .where(eq(qualificationJobs.id, jobId));
      await deps.queue.enqueueQualification({ data, client, startAfterSeconds: delay });
      return { kind: 'retry', nextAttemptDelaySeconds: delay };
    }

    const jobState = settledJobStateForOutcome(result.outcome);
    await tx
      .update(qualificationJobs)
      .set({
        state: assertProviderJobTransition('running', jobState),
        outcome: result.outcome,
        actionOptions: result.actionOptions ?? null,
        lastDiagnosticCode:
          typeof result.diagnostics['code'] === 'string' ? result.diagnostics['code'] : null,
        settledAt: finishedAt,
        updatedAt: finishedAt,
      })
      .where(eq(qualificationJobs.id, jobId));

    if (result.outcome === 'available' && result.offers && search.addressIdentity) {
      const offerTtlMs = (deps.offerTtlDays ?? 7) * 24 * 3600 * 1000;
      for (const offer of result.offers) {
        const [offerRow] = await tx
          .insert(addressOffers)
          .values({
            searchId: data.searchId,
            providerId: data.providerId,
            jobId,
            adapterVersion: data.adapterVersion,
            offerKey: offer.offerKey,
            offer: offer,
            evidenceId,
            addressIdentity: search.addressIdentity,
            addressIdentityVersion: search.addressIdentityVersion ?? 1,
            retrievedAt: finishedAt,
            expiresAt: new Date(finishedAt.getTime() + offerTtlMs),
          })
          .onConflictDoNothing()
          .returning({ id: addressOffers.id });
        if (offerRow) {
          for (const [position, component] of offer.priceComponents.entries()) {
            await tx.insert(offerPriceComponents).values({
              offerId: offerRow.id,
              position,
              componentType: component.type,
              label: component.label,
              amountKind: component.amount.kind,
              amountCents: component.amount.kind === 'known' ? component.amount.amountCents : null,
              unknownReason: component.amount.kind === 'unknown' ? component.amount.reason : null,
              cadence: component.cadence,
              appliesFromMonth: component.appliesFromMonth,
              appliesThroughMonth: component.appliesThroughMonth,
              requiredConditions: [...component.requiredConditions],
              included: component.included,
            });
          }
          for (const [position, condition] of offer.conditions.entries()) {
            await tx.insert(offerConditions).values({
              offerId: offerRow.id,
              position,
              conditionType: condition.type,
              description: condition.description,
            });
          }
        }
      }
    }

    const searchState = await recomputeSearchState(tx, data.searchId, finishedAt);
    await deleteRawAddressIfAllSettled(tx, data.searchId, {
      sweepRunId: newSweepRunId(),
      now: finishedAt,
    });
    return { kind: 'settled', jobState, searchState };
  });
}

export type ProviderActionFailure =
  'not_found' | 'expired' | 'action_not_allowed' | 'invalid_action';

export class ProviderActionError extends Error {
  override readonly name = 'ProviderActionError';
  readonly code: ProviderActionFailure;
  constructor(code: ProviderActionFailure) {
    super(`provider action rejected: ${code}`);
    this.code = code;
  }
}

/**
 * Answers one provider's `action_required` question (a unit/building choice) and re-enqueues
 * ONLY that provider's job. Other providers' results are untouched, and the answer is never
 * copied to them (PLA-364).
 */
export async function submitProviderAction(
  handle: DatabaseHandle,
  queue: JobQueue,
  input: {
    readonly searchId: string;
    readonly providerId: string;
    readonly choice: string;
    readonly now: Date;
  },
): Promise<{ readonly state: string }> {
  return withTransaction(handle, async (tx, client) => {
    const [search] = await tx
      .select()
      .from(searches)
      .where(eq(searches.id, input.searchId))
      .for('update')
      .limit(1);
    if (!search) throw new ProviderActionError('not_found');
    if (isSearchExpired(search, input.now) || input.now.getTime() >= search.deadlineAt.getTime()) {
      throw new ProviderActionError('expired');
    }
    const [job] = await tx
      .select()
      .from(qualificationJobs)
      .where(
        and(
          eq(qualificationJobs.searchId, input.searchId),
          eq(qualificationJobs.providerId, input.providerId),
        ),
      )
      .for('update')
      .limit(1);
    if (!job) throw new ProviderActionError('not_found');
    if (job.state !== 'action_required') throw new ProviderActionError('action_not_allowed');
    if (job.actionOptions && !job.actionOptions.includes(input.choice)) {
      throw new ProviderActionError('invalid_action');
    }
    await tx
      .update(qualificationJobs)
      .set({
        state: assertProviderJobTransition('action_required', 'queued'),
        actionResponse: input.choice,
        outcome: null,
        settledAt: null,
        updatedAt: input.now,
      })
      .where(eq(qualificationJobs.id, job.id));
    // A queued job is pending again, so the recompute keeps the search in partial/qualifying;
    // other providers' completed results stay visible while this one re-runs.
    await recomputeSearchState(tx, input.searchId, input.now);
    // Re-enqueue only this provider's job, inside this transaction.
    const data: QualificationJobData = {
      searchId: input.searchId,
      providerId: input.providerId,
      adapterVersion: job.adapterVersion,
      correlationId: `${input.searchId.slice(0, 8)}:${input.providerId}:resume`,
      deadlineAt: search.deadlineAt.toISOString(),
    };
    await queue.enqueueQualification({ data, client });
    return { state: 'queued' };
  });
}

/**
 * Deadline enforcement: expires unsettled jobs of searches past their global deadline and
 * completes those searches truthfully as partial results. Idempotent; runs on a short worker
 * interval and inside the API read path's tolerance for lag.
 */
export async function enforceSearchDeadlines(
  handle: DatabaseHandle,
  now: Date,
): Promise<{ expiredJobs: number; completedSearches: number }> {
  return withTransaction(handle, async (tx) => {
    const overdue = await tx
      .select({ id: searches.id })
      .from(searches)
      .where(and(lte(searches.deadlineAt, now), inArray(searches.state, ['qualifying', 'partial'])))
      .for('update');
    let expiredJobs = 0;
    let completedSearches = 0;
    for (const row of overdue) {
      const jobs = await tx
        .select()
        .from(qualificationJobs)
        .where(eq(qualificationJobs.searchId, row.id))
        .for('update');
      for (const job of jobs) {
        if (job.state === 'queued' || job.state === 'running' || job.state === 'action_required') {
          await tx
            .update(qualificationJobs)
            .set({
              state: assertProviderJobTransition(job.state, 'expired'),
              lastDiagnosticCode: 'deadline_elapsed',
              settledAt: now,
              updatedAt: now,
            })
            .where(eq(qualificationJobs.id, job.id));
          expiredJobs += 1;
        }
      }
      const state = await recomputeSearchState(tx, row.id, now);
      if (state === 'complete') completedSearches += 1;
      await deleteRawAddressIfAllSettled(tx, row.id, { sweepRunId: newSweepRunId(), now });
    }
    return { expiredJobs, completedSearches };
  });
}
