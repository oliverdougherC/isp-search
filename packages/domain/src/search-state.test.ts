import { describe, expect, it } from 'vitest';

import {
  assertProviderJobTransition,
  assertTransition,
  canProviderJobTransition,
  canTransition,
  computeSearchPhase,
  InvalidTransitionError,
  ProviderJobState,
  SearchState,
  TERMINAL_PROVIDER_JOB_STATES,
  TERMINAL_SEARCH_STATES,
} from './search-state.js';

describe('search state transitions', () => {
  it('terminal states have no outgoing transitions', () => {
    for (const state of TERMINAL_SEARCH_STATES) {
      for (const target of SearchState.options) {
        expect(canTransition(state, target), `${state} -> ${target}`).toBe(false);
      }
    }
  });

  it('a search cannot skip address resolution', () => {
    expect(canTransition('created', 'qualifying')).toBe(false);
    expect(canTransition('created', 'complete')).toBe(false);
  });

  it('partial results can be reported repeatedly and then completed', () => {
    expect(canTransition('qualifying', 'partial')).toBe(true);
    expect(canTransition('partial', 'partial')).toBe(true);
    expect(canTransition('partial', 'complete')).toBe(true);
  });
});

describe('provider job transitions', () => {
  it('terminal job states have no outgoing transitions', () => {
    for (const state of TERMINAL_PROVIDER_JOB_STATES) {
      for (const target of ProviderJobState.options) {
        expect(canProviderJobTransition(state, target), `${state} -> ${target}`).toBe(false);
      }
    }
  });

  it('action_required and degraded can resume to queued but never jump to succeeded', () => {
    expect(canProviderJobTransition('action_required', 'queued')).toBe(true);
    expect(canProviderJobTransition('degraded', 'queued')).toBe(true);
    expect(canProviderJobTransition('action_required', 'succeeded')).toBe(false);
    expect(canProviderJobTransition('degraded', 'succeeded')).toBe(false);
  });

  it('assertProviderJobTransition rejects invalid moves with a typed error', () => {
    expect(() => assertProviderJobTransition('succeeded', 'queued')).toThrow(
      InvalidTransitionError,
    );
    expect(assertProviderJobTransition('queued', 'running')).toBe('running');
  });

  it('assertTransition rejects invalid search moves', () => {
    expect(() => assertTransition('complete', 'qualifying')).toThrow(InvalidTransitionError);
    expect(assertTransition('created', 'resolving_address')).toBe('resolving_address');
  });
});

describe('computeSearchPhase', () => {
  it('is qualifying while nothing settled, partial once anything settles, complete at all-settled', () => {
    expect(computeSearchPhase(['queued', 'running'], { deadlinePassed: false })).toBe('qualifying');
    expect(computeSearchPhase(['succeeded', 'running'], { deadlinePassed: false })).toBe('partial');
    expect(
      computeSearchPhase(['succeeded', 'degraded', 'failed_terminal', 'expired'], {
        deadlinePassed: false,
      }),
    ).toBe('complete');
  });

  it('a provider waiting on user action keeps the search partial, not complete', () => {
    expect(computeSearchPhase(['succeeded', 'action_required'], { deadlinePassed: false })).toBe(
      'partial',
    );
    expect(computeSearchPhase(['action_required'], { deadlinePassed: false })).toBe('partial');
  });

  it('the global deadline forces completion regardless of job states', () => {
    expect(computeSearchPhase(['running', 'action_required'], { deadlinePassed: true })).toBe(
      'complete',
    );
  });

  it('zero candidates completes immediately', () => {
    expect(computeSearchPhase([], { deadlinePassed: false })).toBe('complete');
  });

  it('a mix of succeeded, unknown, degraded, unavailable, and timeout providers can be complete', () => {
    // "Complete" means orchestration finished, not that everything was found (PLA-367).
    expect(
      computeSearchPhase(['succeeded', 'succeeded', 'degraded', 'expired'], {
        deadlinePassed: false,
      }),
    ).toBe('complete');
  });
});
