import { describe, expect, it } from 'vitest';

import { loadPublicEnv } from './index.js';

describe('loadPublicEnv', () => {
  it('only accepts NEXT_PUBLIC_ values and applies defaults', () => {
    const env = loadPublicEnv({ NEXT_PUBLIC_APP_ENV: 'staging', ADDRESS_HMAC_SECRET: 'ignored' });
    expect(env).toEqual({ NEXT_PUBLIC_APP_ENV: 'staging', NEXT_PUBLIC_APP_NAME: 'ISP Search' });
    expect(Object.keys(env).every((key) => key.startsWith('NEXT_PUBLIC_'))).toBe(true);
  });
});
