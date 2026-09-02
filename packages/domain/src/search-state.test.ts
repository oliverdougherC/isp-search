import { describe, expect, it } from 'vitest';

import { canTransition, SearchState, TERMINAL_SEARCH_STATES } from './search-state.js';

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
