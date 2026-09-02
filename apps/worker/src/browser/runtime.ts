import type { BrowserContextOptions, LaunchOptions } from 'playwright';

/**
 * Browser runtime policy for future reviewed adapters (ADR-004). Nothing here launches a
 * browser in M1; the module fixes the invariants any later adapter must satisfy:
 *
 *  - every qualification runs in a fresh, isolated context with no persistent profile;
 *  - no cookies, storage state, or sessions are shared or persisted between runs;
 *  - no proxy, no fingerprint spoofing, no CAPTCHA interaction;
 *  - screenshots, videos, and HAR recording are disabled unless debug capture is explicitly
 *    enabled with a bounded TTL (never in normal operation).
 */
export interface BrowserPolicy {
  readonly launch: LaunchOptions;
  readonly context: BrowserContextOptions;
}

export function isolatedBrowserPolicy(options: { readonly locale?: string } = {}): BrowserPolicy {
  return {
    launch: {
      headless: true,
      chromiumSandbox: true,
      // Deliberately no `proxy`, no custom executable, no persistent profile.
    },
    context: {
      locale: options.locale ?? 'en-US',
      acceptDownloads: false,
      javaScriptEnabled: true,
      // No storageState: every run starts with an empty cookie jar.
    },
  };
}

/** True when a policy would persist or share session material. Used by tests as a guard. */
export function policyLeaksSession(policy: BrowserPolicy): boolean {
  const context = policy.context as Record<string, unknown>;
  return (
    ('storageState' in context && context['storageState'] !== undefined) ||
    'proxy' in policy.launch ||
    'recordHar' in context ||
    'recordVideo' in context
  );
}
