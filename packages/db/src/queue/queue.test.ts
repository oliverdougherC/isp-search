import { describe, expect, it } from 'vitest';

import { qualificationSingletonKey, retryLimitForOutcome } from './index.js';

describe('queue policies', () => {
  it('derives one singleton key per search/provider/adapter version', () => {
    const base = {
      searchId: 's1',
      providerId: 'p1',
      adapterVersion: '1.0.0',
      correlationId: 'c',
      deadlineAt: new Date(0).toISOString(),
    };
    expect(qualificationSingletonKey(base)).toBe('s1:p1:1.0.0');
    expect(qualificationSingletonKey({ ...base, adapterVersion: '1.0.1' })).not.toBe(
      qualificationSingletonKey(base),
    );
  });

  it('maps failure classes to different retry budgets', () => {
    expect(retryLimitForOutcome('unavailable', 3)).toBe(0);
    expect(retryLimitForOutcome('unit_required', 3)).toBe(0);
    expect(retryLimitForOutcome('timeout', 3)).toBe(3);
    expect(retryLimitForOutcome('rate_limited', 3)).toBe(3);
    expect(retryLimitForOutcome('captcha', 3)).toBe(0);
    expect(retryLimitForOutcome('upstream_changed', 3)).toBe(0);
  });
});
