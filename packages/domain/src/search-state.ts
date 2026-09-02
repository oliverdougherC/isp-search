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

export const TERMINAL_SEARCH_STATES: ReadonlySet<SearchState> = new Set<SearchState>([
  'complete',
  'expired',
  'failed',
]);
