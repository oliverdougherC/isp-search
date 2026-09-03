import { describe, expect, it } from 'vitest';

import type { ProviderAdapter } from './contract.js';
import { referenceAdapterFor } from './reference/index.js';
import { createAdapterRegistry } from './registry.js';

describe('adapter registry', () => {
  it('disables adapters by configuration without removing them', () => {
    const registry = createAdapterRegistry(
      [referenceAdapterFor('available'), referenceAdapterFor('unavailable')],
      {
        enabledProviderIds: new Set(['reference-available']),
      },
    );
    expect(registry.get('reference-available')?.enabled).toBe(true);
    expect(registry.get('reference-unavailable')?.enabled).toBe(false);
    expect(registry.list()).toHaveLength(2);
  });

  it('rejects live-tier adapters unless explicitly allowed', () => {
    const live: ProviderAdapter = {
      ...referenceAdapterFor('available'),
      id: 'live:test',
      tier: 'reviewed_browser_flow',
    };
    expect(() => createAdapterRegistry([live], { enabledProviderIds: new Set() })).toThrow(
      /ADR-004/,
    );
    expect(() =>
      createAdapterRegistry([live], { enabledProviderIds: new Set(), allowLiveTiers: true }),
    ).not.toThrow();
  });

  it('rejects duplicate provider registrations', () => {
    const adapter = referenceAdapterFor('available');
    expect(() =>
      createAdapterRegistry([adapter, adapter], { enabledProviderIds: new Set() }),
    ).toThrow(/duplicate/);
  });
});

describe('reference adapter production gate', () => {
  it('yields an empty set in production unless explicitly allowed', async () => {
    const { referenceAdapterSetForEnvironment } = await import('./reference/index.js');
    expect(
      referenceAdapterSetForEnvironment({ nodeEnv: 'production', allowReferenceAdapters: false }),
    ).toHaveLength(0);
    expect(
      referenceAdapterSetForEnvironment({ nodeEnv: 'production', allowReferenceAdapters: true }),
    ).toHaveLength(11);
    expect(
      referenceAdapterSetForEnvironment({ nodeEnv: 'development', allowReferenceAdapters: false }),
    ).toHaveLength(11);
  });
});
