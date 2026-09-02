import { describe, expect, it } from 'vitest';

import { isolatedBrowserPolicy, policyLeaksSession } from './runtime.js';

describe('isolated browser policy', () => {
  it('never persists sessions, proxies, or recordings', () => {
    const policy = isolatedBrowserPolicy();
    expect(policyLeaksSession(policy)).toBe(false);
    expect(policy.launch.headless).toBe(true);
    expect(policy.context.acceptDownloads).toBe(false);
  });

  it('detects a leaking policy', () => {
    const leaking = { ...isolatedBrowserPolicy(), context: { storageState: 'state.json' } };
    expect(policyLeaksSession(leaking)).toBe(true);
  });
});
