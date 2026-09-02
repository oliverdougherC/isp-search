import type { IntegrationTier, ProviderAdapter } from './contract.js';

export interface AdapterRegistration {
  readonly adapter: ProviderAdapter;
  /** Enabled adapters may be invoked; disabled ones resolve to link-only behaviour. */
  readonly enabled: boolean;
}

export interface AdapterRegistry {
  get(providerId: string): AdapterRegistration | undefined;
  list(): readonly AdapterRegistration[];
}

/**
 * Registry with a configuration-driven kill switch: any adapter can be disabled (downgraded to
 * link-only) without code removal by omitting it from `enabledProviderIds`.
 *
 * Tiers that are never allowed to run live in this codebase yet are rejected at registration.
 */
const LIVE_TIERS: ReadonlySet<IntegrationTier> = new Set<IntegrationTier>([
  'official_api',
  'documented_public_api',
  'reviewed_browser_flow',
]);

export function createAdapterRegistry(
  adapters: readonly ProviderAdapter[],
  options: { readonly enabledProviderIds: ReadonlySet<string>; readonly allowLiveTiers?: boolean },
): AdapterRegistry {
  const entries = new Map<string, AdapterRegistration>();
  for (const adapter of adapters) {
    if (entries.has(adapter.providerId)) {
      throw new Error(`duplicate adapter registration for provider ${adapter.providerId}`);
    }
    if (LIVE_TIERS.has(adapter.tier) && !options.allowLiveTiers) {
      throw new Error(
        `adapter ${adapter.id} has live tier ${adapter.tier}; live adapters are gated by ADR-004 and not enabled in this build`,
      );
    }
    entries.set(adapter.providerId, {
      adapter,
      enabled: options.enabledProviderIds.has(adapter.providerId),
    });
  }
  return {
    get: (providerId) => entries.get(providerId),
    list: () => [...entries.values()],
  };
}
