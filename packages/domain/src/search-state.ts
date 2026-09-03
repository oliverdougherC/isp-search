import { z } from 'zod';

export const SearchState = z.enum([
  'created',
  'resolving_address',
  'address_action_required',
  'discovering_candidates',
  'qualifying',
  'partial',
  'complete',
  'expired',
  'failed',
]);
export type SearchState = z.infer<typeof SearchState>;

export const ProviderJobState = z.enum([
  'queued',
  'running',
  'succeeded',
  'action_required',
  'degraded',
  'failed_terminal',
  'expired',
]);
export type ProviderJobState = z.infer<typeof ProviderJobState>;

/**
 * Allowed search-level transitions. `partial` and `complete` describe orchestration, not
 * whether results are available. The full state machine is implemented in M2 (PLA-360); the
 * transition table is declared here so that M1 tests and docs share one source.
 */
export const SEARCH_TRANSITIONS: Readonly<Record<SearchState, readonly SearchState[]>> = {
  created: ['resolving_address', 'failed', 'expired'],
  resolving_address: ['address_action_required', 'discovering_candidates', 'failed', 'expired'],
  address_action_required: ['resolving_address', 'expired', 'failed'],
  discovering_candidates: ['qualifying', 'partial', 'complete', 'failed', 'expired'],
  qualifying: ['partial', 'complete', 'failed', 'expired'],
  partial: ['partial', 'complete', 'expired'],
  complete: [],
  expired: [],
  failed: [],
};

export function canTransition(from: SearchState, to: SearchState): boolean {
  return SEARCH_TRANSITIONS[from].includes(to);
}

/** Applies a transition or throws. Persistence and orchestration go through this. */
export function assertTransition(from: SearchState, to: SearchState): SearchState {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError('search', from, to);
  }
  return to;
}

export const TERMINAL_SEARCH_STATES: ReadonlySet<SearchState> = new Set<SearchState>([
  'complete',
  'expired',
  'failed',
]);

export class InvalidTransitionError extends Error {
  override readonly name = 'InvalidTransitionError';
  constructor(machine: 'search' | 'provider_job', from: string, to: string) {
    super(`invalid ${machine} transition ${from} -> ${to}`);
  }
}

/**
 * Provider-job transitions (PLA-360). `queued` from `running` is the at-least-once redelivery
 * path (crash or bounded transient retry); `queued` from `action_required` or `degraded` is an
 * explicit resume (user action, circuit close). Terminal states never move.
 */
export const PROVIDER_JOB_TRANSITIONS: Readonly<
  Record<ProviderJobState, readonly ProviderJobState[]>
> = {
  queued: ['running', 'expired', 'failed_terminal'],
  running: ['succeeded', 'action_required', 'degraded', 'failed_terminal', 'expired', 'queued'],
  action_required: ['queued', 'expired'],
  degraded: ['queued', 'expired'],
  succeeded: [],
  failed_terminal: [],
  expired: [],
};

export function canProviderJobTransition(from: ProviderJobState, to: ProviderJobState): boolean {
  return PROVIDER_JOB_TRANSITIONS[from].includes(to);
}

export function assertProviderJobTransition(
  from: ProviderJobState,
  to: ProviderJobState,
): ProviderJobState {
  if (!canProviderJobTransition(from, to)) {
    throw new InvalidTransitionError('provider_job', from, to);
  }
  return to;
}

/** States in which a job will make no further progress without an explicit resume. */
export const SETTLED_PROVIDER_JOB_STATES: ReadonlySet<ProviderJobState> = new Set<ProviderJobState>(
  ['succeeded', 'degraded', 'failed_terminal', 'expired'],
);

/** States from which a job can never run again, even with a resume. */
export const TERMINAL_PROVIDER_JOB_STATES: ReadonlySet<ProviderJobState> =
  new Set<ProviderJobState>(['succeeded', 'failed_terminal', 'expired']);

/**
 * Deterministic orchestration phase from the provider jobs of one search (PLA-367).
 *
 * `complete` means orchestration finished — every job settled or the global deadline passed —
 * not that anything was found. `action_required` jobs do not block completed peers from being
 * visible (`partial`), but a search is not `complete` while one still waits, unless the
 * deadline expires it.
 */
export function computeSearchPhase(
  jobStates: readonly ProviderJobState[],
  options: { readonly deadlinePassed: boolean },
): Extract<SearchState, 'qualifying' | 'partial' | 'complete'> {
  if (options.deadlinePassed) return 'complete';
  if (jobStates.length === 0) return 'complete';
  const settled = jobStates.filter((state) => SETTLED_PROVIDER_JOB_STATES.has(state)).length;
  if (settled === jobStates.length) return 'complete';
  if (settled > 0 || jobStates.some((state) => state === 'action_required')) return 'partial';
  return 'qualifying';
}
